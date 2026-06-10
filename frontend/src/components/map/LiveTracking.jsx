import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import socket from "../../socket/socket.js";
import api from "../../services/api.js";
import { FiActivity, FiMapPin, FiCompass } from "react-icons/fi";

// Custom premium marker icons matching brand aesthetics
const ambulanceIcon = L.divIcon({
  html: `<div style="font-size: 26px; filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.9)); display: flex; align-items: center; justify-content: center;">🚑</div>`,
  className: "custom-ambulance-marker",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

const hospitalIcon = L.divIcon({
  html: `<div style="font-size: 24px; filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.8)); display: flex; align-items: center; justify-content: center;">🏥</div>`,
  className: "custom-hospital-marker",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

function LiveTracking() {
    const [ambulanceLocation, setAmbulanceLocation] = useState(null);
    const [hospitalLocation, setHospitalLocation] = useState(null);
    const [hospitalInfo, setHospitalInfo] = useState(null);

    const [assignedDriverId, setAssignedDriverId] = useState(null);
    const assignedDriverIdRef = useRef(assignedDriverId);
    useEffect(() => {
        assignedDriverIdRef.current = assignedDriverId;
    }, [assignedDriverId]);

    const [eta, setEta] = useState(null);
    const [distance, setDistance] = useState(null);
    const [trafficLevel, setTrafficLevel] = useState("");
    const [routeCoordinates, setRouteCoordinates] = useState([]);

    // Bulletproof coordinate validation guards
    const hasValidAmbulance = ambulanceLocation && 
        typeof ambulanceLocation.lat === "number" && 
        typeof ambulanceLocation.lng === "number" && 
        !isNaN(ambulanceLocation.lat) && 
        !isNaN(ambulanceLocation.lng);

    const hasValidHospital = hospitalLocation && 
        typeof hospitalLocation.lat === "number" && 
        typeof hospitalLocation.lng === "number" && 
        !isNaN(hospitalLocation.lat) && 
        !isNaN(hospitalLocation.lng);

    // Fetch active transit requests on component load to preserve state on reload
    useEffect(() => {
        const fetchActiveTransit = async () => {
            try {
                const response = await api.get("/emergency/all");
                const requests = response.data.requests || [];
                const transitTrip = requests.find(r => r.status === "in_transit");
                
                if (transitTrip) {
                    if (transitTrip.dropoffLocation && transitTrip.dropoffLocation.coordinates) {
                        const hLng = transitTrip.dropoffLocation.coordinates[0];
                        const hLat = transitTrip.dropoffLocation.coordinates[1];
                        setHospitalLocation({ lat: hLat, lng: hLng });
                        setHospitalInfo({
                            name: "Assigned Trauma Center",
                            coordinates: [hLng, hLat]
                        });
                    }
                    // Fetch driver location if available in the trip or fallback to pickup
                    if (transitTrip.driverId) {
                        setAssignedDriverId(transitTrip.driverId._id || transitTrip.driverId);
                        // Optionally fetch driver location or use pickup as starting point
                        const pLng = transitTrip.pickupLocation.coordinates[0];
                        const pLat = transitTrip.pickupLocation.coordinates[1];
                        setAmbulanceLocation({ lat: pLat, lng: pLng });
                    }
                }
            } catch (err) {
                console.warn("Failed to load active transit on mount:", err);
            }
        };

        fetchActiveTransit();
    }, []);

    // Websockets event listeners
    useEffect(() => {
        const handleRouteToHospital = (data) => {
            console.log("Socket: route_to_hospital event triggered", data);
            if (data && data.hospital && data.hospital.coordinates) {
                const hLng = data.hospital.coordinates[0];
                const hLat = data.hospital.coordinates[1];
                setHospitalLocation({ lat: hLat, lng: hLng });
                setHospitalInfo(data.hospital);

                if (data.driverLocation) {
                    setAmbulanceLocation(data.driverLocation);
                }
                if (data.driverId) {
                    setAssignedDriverId(data.driverId);
                }
            }
        };

        const handleDriverLocationUpdated = (data) => {
            if (data && typeof data.lat === "number" && typeof data.lng === "number") {
                const assignedId = assignedDriverIdRef.current;
                if (assignedId && data.driverId && data.driverId.toString() === assignedId.toString()) {
                    setAmbulanceLocation({ lat: data.lat, lng: data.lng });
                }
            }
        };

        const handleDriverLocationUpdatedManual = (data) => {
            if (data && typeof data.lat === "number" && typeof data.lng === "number") {
                const assignedId = assignedDriverIdRef.current;
                if (assignedId && data.driverId && data.driverId.toString() === assignedId.toString()) {
                    setAmbulanceLocation({ lat: data.lat, lng: data.lng });
                }
            }
        };

        const handleStatusUpdated = (data) => {
            if (data && (data.status === "completed" || data.status === "cancelled")) {
                setHospitalLocation(null);
                setHospitalInfo(null);
                setRouteCoordinates([]);
                setDistance(null);
                setEta(null);
                setTrafficLevel("");
            }
        };

        const handleLocationOverrideReset = (data) => {
            console.log("Socket: location_override_reset", data);
        };

        socket.on("route_to_hospital", handleRouteToHospital);
        socket.on("driverLocationUpdated", handleDriverLocationUpdated);
        socket.on("driver_location_updated", handleDriverLocationUpdatedManual);
        socket.on("emergencyStatusUpdated", handleStatusUpdated);
        socket.on("location_override_reset", handleLocationOverrideReset);

        return () => {
            socket.off("route_to_hospital", handleRouteToHospital);
            socket.off("driverLocationUpdated", handleDriverLocationUpdated);
            socket.off("driver_location_updated", handleDriverLocationUpdatedManual);
            socket.off("emergencyStatusUpdated", handleStatusUpdated);
            socket.off("location_override_reset", handleLocationOverrideReset);
        };
    }, []);

    // Calculate routing polyline when coordinates change (real road routing with OSRM, ORS, and simulated fallbacks)
    useEffect(() => {
        const calculateRoute = async () => {
            if (!hasValidAmbulance || !hasValidHospital) return;

            const startLat = ambulanceLocation.lat;
            const startLng = ambulanceLocation.lng;
            const endLat = hospitalLocation.lat;
            const endLng = hospitalLocation.lng;

            const handleSimulatedFallback = () => {
                const R = 6371; // km
                const dLat = (endLat - startLat) * Math.PI / 180;
                const dLon = (endLng - startLng) * Math.PI / 180;
                const a = 
                    Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) * 
                    Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const straightDistance = R * c;
                const distanceKm = (straightDistance * 1.3).toFixed(2);
                const durationMin = Math.max(1, Math.round(distanceKm * 1.7));

                setDistance(distanceKm);
                setEta(durationMin);
                setTrafficLevel(durationMin <= 10 ? "Low" : durationMin <= 20 ? "Moderate" : "High");

                const segments = 15;
                const coords = [];
                for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    let lat = startLat + (endLat - startLat) * t;
                    let lng = startLng + (endLng - startLng) * t;
                    if (i > 0 && i < segments) {
                        const offset = Math.sin(t * Math.PI) * 0.0025;
                        const dx = endLng - startLng;
                        const dy = endLat - startLat;
                        const len = Math.sqrt(dx*dx + dy*dy);
                        if (len > 0) {
                            lat += (-dx / len) * offset;
                            lng += (dy / len) * offset;
                        }
                    }
                    coords.push([lat, lng]);
                }
                setRouteCoordinates(coords);
            };

            // Option 1: Try free OSRM API (Real road network)
            try {
                const response = await fetch(
                    `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.code === "Ok" && data.routes && data.routes.length > 0) {
                        const route = data.routes[0];
                        const distanceKm = (route.distance / 1000).toFixed(2);
                        const durationMin = (route.duration / 60).toFixed(0);

                        setDistance(distanceKm);
                        setEta(durationMin);
                        setTrafficLevel(durationMin <= 10 ? "Low" : durationMin <= 20 ? "Moderate" : "High");

                        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        setRouteCoordinates(coordinates);
                        return; // Success
                    }
                }
            } catch (osrmErr) {
                console.warn("OSRM routing failed, trying OpenRouteService...", osrmErr);
            }

            // Option 2: Try ORS API (requires VITE_ORS_API_KEY)
            try {
                const apiKey = import.meta.env.VITE_ORS_API_KEY;
                if (apiKey && !apiKey.includes("your_") && apiKey.length > 20) {
                    const response = await fetch(
                        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startLng},${startLat}&end=${endLng},${endLat}`
                    );
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.features && data.features.length > 0) {
                            const summary = data.features[0].properties.summary;
                            const distanceKm = (summary.distance / 1000).toFixed(2);
                            const durationMin = (summary.duration / 60).toFixed(0);

                            setDistance(distanceKm);
                            setEta(durationMin);
                            setTrafficLevel(durationMin <= 10 ? "Low" : durationMin <= 20 ? "Moderate" : "High");

                            const coords = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                            setRouteCoordinates(coords);
                            return; // Success
                        }
                    }
                }
            } catch (err) {
                console.warn("ORS route calculation failed. Shifting to high-fidelity simulated engine:", err);
            }

            // Option 3: Fallback to simulated line
            console.log("All real routing services failed. Using curved simulated fallback.");
            handleSimulatedFallback();
        };

        calculateRoute();
    }, [ambulanceLocation?.lat, ambulanceLocation?.lng, hospitalLocation?.lat, hospitalLocation?.lng, hasValidAmbulance, hasValidHospital]);

    return (
        <div className="min-h-screen bg-[#0b0f17] text-white p-6 font-sans flex flex-col justify-between">
            {/* Top Header Bar */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <span className="animate-pulse text-red-500">📡</span> Live Triage Tracking
                    </h1>
                    <p className="text-gray-400 text-xs mt-1">Real-time hospital navigation dashboard</p>
                </div>
                {hospitalInfo && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse flex items-center gap-1.5">
                        <FiActivity className="w-3.5 h-3.5" /> Boarded Transit Active
                    </span>
                )}
            </div>

            {/* Diagnostics Card */}
            <div className="bg-[#121620]/80 backdrop-blur-xl border border-gray-800/80 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">Destination Facility</span>
                    <h3 className="text-md font-bold text-white mt-1 flex items-center gap-1.5">
                        <FiMapPin className="text-emerald-400" /> {hospitalInfo ? hospitalInfo.name : "Waiting for driver to board patient..."}
                    </h3>
                </div>

                <div className="grid grid-cols-3 gap-6 md:flex md:items-center md:gap-8 justify-end">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">ETA to Hospital</span>
                        <span className="text-sm font-bold text-white mt-1 font-mono">{eta ? `${eta} mins` : "Calculating..."}</span>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Distance</span>
                        <span className="text-sm font-bold text-white mt-1 font-mono">{distance ? `${distance} km` : "Calculating..."}</span>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Traffic Congestion</span>
                        <div>
                            <span className={`inline-block text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md ${
                                trafficLevel === "Low" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : 
                                trafficLevel === "Moderate" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : 
                                trafficLevel === "High" ? "bg-red-500/15 text-red-400 border border-red-500/20" : 
                                "bg-gray-800/40 text-gray-400 border border-gray-800"
                            }`}>
                                {trafficLevel || "Analyzing..."}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Canvas */}
            <div className="relative flex-grow min-h-[50vh] rounded-3xl overflow-hidden border border-gray-800 shadow-2xl z-0 mb-4">
                <MapContainer
                    center={hasValidAmbulance ? [ambulanceLocation.lat, ambulanceLocation.lng] : [25.591, 85.1376]}
                    zoom={14}
                    style={{
                        height: "100%",
                        width: "100%",
                        filter: "invert(90%) hue-rotate(180deg) brightness(85%) contrast(110%)"
                    }}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                    {/* Ambulance Marker */}
                    {hasValidAmbulance && (
                        <Marker position={[ambulanceLocation.lat, ambulanceLocation.lng]} icon={ambulanceIcon}>
                            <Popup>
                                <div className="p-2 font-sans text-xs bg-[#161a23] text-white rounded-lg border border-gray-800">
                                    <h4 className="font-bold text-blue-400">Ambulance (Approaching)</h4>
                                    <p className="text-gray-500 text-[10px] mt-1 font-mono">
                                        Lat: {ambulanceLocation.lat.toFixed(4)}, Lng: {ambulanceLocation.lng.toFixed(4)}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Hospital Marker */}
                    {hasValidHospital && (
                        <Marker position={[hospitalLocation.lat, hospitalLocation.lng]} icon={hospitalIcon}>
                            <Popup>
                                <div className="p-2 font-sans text-xs bg-[#161a23] text-white rounded-lg border border-gray-800">
                                    <h4 className="font-bold text-emerald-400">{hospitalInfo?.name || "Trauma Ward"}</h4>
                                    <p className="text-gray-400 text-[10px]">{hospitalInfo?.email}</p>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Polyline Route */}
                    {hasValidAmbulance && hasValidHospital && routeCoordinates.length > 0 && (
                        <Polyline positions={routeCoordinates} pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.8 }} />
                    )}
                </MapContainer>
            </div>

            {/* Bottom Status Help Panel */}
            <div className="bg-[#121620]/40 border border-gray-800/60 p-4 rounded-2xl flex items-center gap-3">
                <FiCompass className="w-5 h-5 text-blue-400 animate-spin-slow" />
                <p className="text-xs text-gray-400 leading-relaxed">
                    Once the paramedic crew claims the rescue and clicks the <strong className="text-white">Board Patient</strong> action, the system uses spatial indexing to locate the absolute closest prepped clinic and redirects this telemetry layout live to track the hospital route.
                </p>
            </div>
        </div>
    );
}

export default LiveTracking;