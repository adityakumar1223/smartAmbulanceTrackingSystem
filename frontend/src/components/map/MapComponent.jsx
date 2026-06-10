import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from 'react';
import api from "../../services/api.js";
import Radar from "radar-sdk-js";

// Custom premium marker icons using divIcons
const patientIcon = L.divIcon({
  html: `<div style="font-size: 26px; filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.9)); display: flex; align-items: center; justify-content: center;">🚨</div>`,
  className: 'custom-patient-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

const ambulanceIcon = L.divIcon({
  html: `<div style="font-size: 26px; filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.9)); display: flex; align-items: center; justify-content: center;">🚑</div>`,
  className: 'custom-ambulance-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

const hospitalIcon = L.divIcon({
  html: `<div style="font-size: 24px; filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.8)); display: flex; align-items: center; justify-content: center;">🏥</div>`,
  className: 'custom-hospital-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

function MapComponent({pickupLocation, driverLocation, dropoffLocation, status}){

    const [hospitals, setHospitals] = useState([]);

    const patientLocation = (pickupLocation && Array.isArray(pickupLocation.coordinates) && pickupLocation.coordinates.length >= 2) ? {
        lat: Number(pickupLocation.coordinates[1]),
        lng: Number(pickupLocation.coordinates[0])
     } : null;

    const hospitalLocation = (dropoffLocation && Array.isArray(dropoffLocation.coordinates) && dropoffLocation.coordinates.length >= 2) ? {
        lat: Number(dropoffLocation.coordinates[1]),
        lng: Number(dropoffLocation.coordinates[0])
    } : null;

    const [ambulanceLocation, setAmbulanceLocation] = useState(driverLocation || null);

    // Bulletproof coordinate validation
    const hasValidAmbulanceCoords = ambulanceLocation && 
        typeof ambulanceLocation.lat === "number" && 
        typeof ambulanceLocation.lng === "number" && 
        !isNaN(ambulanceLocation.lat) && 
        !isNaN(ambulanceLocation.lng);

    const hasValidPatientCoords = patientLocation && 
        typeof patientLocation.lat === "number" && 
        typeof patientLocation.lng === "number" && 
        !isNaN(patientLocation.lat) && 
        !isNaN(patientLocation.lng);

    const hasValidHospitalCoords = hospitalLocation && 
        typeof hospitalLocation.lat === "number" && 
        typeof hospitalLocation.lng === "number" && 
        !isNaN(hospitalLocation.lat) && 
        !isNaN(hospitalLocation.lng);

    const [eta, setEta] = useState(null);
    const [distance, setDistance] = useState(null);
    const [trafficLevel, setTrafficLevel] = useState("");

    const [routeCoordinates, setRouteCoordinates] = useState([]);

    // Haversine distance calculator
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2 || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return (R * c).toFixed(1);
    };

    // Query active nearby trauma centers
    useEffect(() => {
        const fetchHospitals = async () => {
            const activeStatuses = ["accepted", "on_the_way", "arrived"];
            const isTripActive = (status && activeStatuses.includes(status)) || driverLocation;
            if (!isTripActive) {
                setHospitals([]);
                return;
            }
            try {
                const response = await api.get("/user/hospitals");
                const dbHospitals = response.data.hospitals || [];
                
                if (dbHospitals.length > 0) {
                    setHospitals(dbHospitals);
                } else if (hasValidPatientCoords) {
                    // Fallback to Radar place search if no database hospitals found
                    Radar.searchPlaces({
                        near: {
                            latitude: patientLocation.lat,
                            longitude: patientLocation.lng
                        },
                        radius: 5000,
                        categories: ['medical-health'],
                        limit: 10
                    }).then((result) => {
                        if (result && result.places) {
                            const radarHospitals = result.places.map(p => ({
                                _id: p._id,
                                name: p.name,
                                email: p.chain?.name || 'radar-medical@facility.local',
                                currentLocation: {
                                    type: "Point",
                                    coordinates: [p.location.coordinates[0], p.location.coordinates[1]]
                                }
                            }));
                            setHospitals(radarHospitals);
                        }
                    }).catch(err => console.warn("Radar places search failed:", err));
                }
            } catch (err) {
                console.error("Failed to fetch database hospitals, trying Radar place search...", err);
                if (hasValidPatientCoords) {
                    Radar.searchPlaces({
                        near: {
                            latitude: patientLocation.lat,
                            longitude: patientLocation.lng
                        },
                        radius: 5000,
                        categories: ['medical-health'],
                        limit: 10
                    }).then((result) => {
                        if (result && result.places) {
                            const radarHospitals = result.places.map(p => ({
                                _id: p._id,
                                name: p.name,
                                email: p.chain?.name || 'radar-medical@facility.local',
                                currentLocation: {
                                    type: "Point",
                                    coordinates: [p.location.coordinates[0], p.location.coordinates[1]]
                                }
                            }));
                            setHospitals(radarHospitals);
                        }
                    }).catch(rErr => console.error("Radar fallback places search failed:", rErr));
                }
            }
        };

        fetchHospitals();
    }, [status, driverLocation, hasValidPatientCoords, patientLocation?.lat, patientLocation?.lng]);

    // NOTE: driverLocationUpdated listener removed here (BUG-10).
    // EmergencyContext already listens for this event and passes driverLocation as a prop.
    // Having dual listeners caused double-firing and state drift.

    useEffect(() => {
        if(driverLocation){
            setAmbulanceLocation(driverLocation);
        }
    }, [driverLocation]);

    // Real road routing with OSRM, ORS, and simulated fallback
    useEffect(() => {
        const fetchRoute = async () => {
            const isTransit = status === "in_transit" || status === "boarded";
            const destination = isTransit ? hospitalLocation : patientLocation;
            
            const hasValidDestination = destination && 
                typeof destination.lat === "number" && 
                typeof destination.lng === "number" && 
                !isNaN(destination.lat) && 
                !isNaN(destination.lng);

            if (!hasValidDestination || !hasValidAmbulanceCoords) return;

            const startLat = ambulanceLocation.lat;
            const startLng = ambulanceLocation.lng;
            const endLat = destination.lat;
            const endLng = destination.lng;

            const handleSimulatedRoute = () => {
                // Haversine formula
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
                
                const segments = 12;
                const simulatedCoords = [];
                for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    let lat = startLat + (endLat - startLat) * t;
                    let lng = startLng + (endLng - startLng) * t;
                    
                    if (i > 0 && i < segments) {
                        const offset = Math.sin(t * Math.PI) * 0.003;
                        const dx = endLng - startLng;
                        const dy = endLat - startLat;
                        const len = Math.sqrt(dx*dx + dy*dy);
                        if (len > 0) {
                            lat += (-dx / len) * offset;
                            lng += (dy / len) * offset;
                        }
                    }
                    simulatedCoords.push([lat, lng]);
                }
                setRouteCoordinates(simulatedCoords);
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

                            const coordinates = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                            setRouteCoordinates(coordinates);
                            return; // Success
                        }
                    }
                }
            } catch (orsError) {
                console.warn("ORS API routing failed...", orsError);
            }

            // Option 3: Fallback to simulated line
            console.log("All real routing services failed. Using curved simulated fallback.");
            handleSimulatedRoute();
        };

        fetchRoute();

    }, [
        ambulanceLocation?.lat,
        ambulanceLocation?.lng,
        patientLocation?.lat,
        patientLocation?.lng,
        hospitalLocation?.lat,
        hospitalLocation?.lng,
        hasValidAmbulanceCoords,
        hasValidPatientCoords,
        hasValidHospitalCoords,
        status
    ]);

    return ( 
        <div className="space-y-4 w-full">
            {/* Glassmorphic Route Diagnostics Card (Placed Outside/Above Map) */}
            <div className="bg-[#161a23]/75 backdrop-blur-xl border border-gray-800/80 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans text-[#e5e7eb] animate-fadeIn">
                <div>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Route Diagnostics</h3>
                    <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Real-time emergency transit telemetry</p>
                </div>
                
                <div className="grid grid-cols-3 gap-6 sm:flex sm:items-center sm:gap-8 flex-grow justify-end">
                    {/* ETA */}
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">ETA</span>
                        <span className="text-sm font-bold text-white mt-1 font-mono">{eta ? `${eta} mins` : "Calculating..."}</span>
                    </div>
                    
                    {/* Distance */}
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Distance</span>
                        <span className="text-sm font-bold text-white mt-1 font-mono">{distance ? `${distance} km` : "Calculating..."}</span>
                    </div>
                    
                    {/* Traffic Status */}
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Traffic Status</span>
                        <div>
                            <span className={`inline-block text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md ${
                                trafficLevel === "Low" ? "bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20" : 
                                trafficLevel === "Moderate" ? "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20" : 
                                trafficLevel === "High" ? "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/20" : 
                                "bg-gray-800/40 text-gray-400 border border-gray-800"
                            }`}>
                                {trafficLevel || "Analyzing..."}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Canvas */}
            <div className="relative w-full h-[40vh] sm:h-[50vh] md:h-[60vh] rounded-2xl overflow-hidden border border-gray-800 z-0">
                <MapContainer
                    center = {
                        hasValidAmbulanceCoords 
                            ? [ambulanceLocation.lat, ambulanceLocation.lng] 
                            : (hasValidPatientCoords ? [patientLocation.lat, patientLocation.lng] : [25.591, 85.1376])
                    }
                    zoom = {13}
                    style = {{
                        height: "100%",
                        width: "100%",
                        filter: "invert(90%) hue-rotate(180deg) brightness(85%) contrast(110%)"
                    }} >
        
                    <TileLayer 
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
        
                    {/* Ambulance marker */}
                    {hasValidAmbulanceCoords && (
                        <Marker 
                            position={[
                                ambulanceLocation.lat,
                                ambulanceLocation.lng
                            ]}
                            icon={ambulanceIcon}
                        >
                            <Popup>
                                <div className="p-2 font-sans text-xs bg-[#161a23] text-white rounded-lg border border-gray-800">
                                    <h4 className="font-bold text-blue-400">Ambulance (Live)</h4>
                                    <p className="text-gray-500 text-[10px] mt-1 font-mono">
                                        Lat: {ambulanceLocation.lat.toFixed(4)}, Lng: {ambulanceLocation.lng.toFixed(4)}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )}
        
                    {/* Patient marker */}
                    {hasValidPatientCoords && (
                        <Marker
                            position={[
                                patientLocation.lat,
                                patientLocation.lng
                            ]}
                            icon={patientIcon}
                        >
                            <Popup>
                                <div className="p-2 font-sans text-xs bg-[#161a23] text-white rounded-lg border border-gray-800">
                                    <h4 className="font-bold text-red-400">Patient Emergency</h4>
                                    <p className="text-gray-500 text-[10px] mt-1 font-mono">
                                        Lat: {patientLocation.lat.toFixed(4)}, Lng: {patientLocation.lng.toFixed(4)}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Hospital markers */}
                    {hospitals.map((hospital) => {
                        const hasCoords = hospital.currentLocation && 
                            Array.isArray(hospital.currentLocation.coordinates) && 
                            hospital.currentLocation.coordinates.length >= 2;
                        if (!hasCoords) return null;
                        
                        const hLat = Number(hospital.currentLocation.coordinates[1]);
                        const hLng = Number(hospital.currentLocation.coordinates[0]);
                        if (isNaN(hLat) || isNaN(hLng)) return null;

                        const distToPatient = hasValidPatientCoords 
                            ? calculateDistance(hLat, hLng, patientLocation.lat, patientLocation.lng)
                            : null;

                        return (
                            <Marker
                                key={hospital._id || hospital.id}
                                position={[hLat, hLng]}
                                icon={hospitalIcon}
                            >
                                <Popup>
                                    <div className="p-2.5 font-sans text-xs bg-[#161a23] text-white rounded-xl border border-gray-800 shadow-xl min-w-[180px]">
                                        <div className="flex items-center gap-1.5 border-b border-gray-800 pb-1.5 mb-1.5">
                                            <span className="text-md">🏥</span>
                                            <h4 className="font-bold text-green-400 leading-tight">{hospital.name}</h4>
                                        </div>
                                        <p className="text-gray-400 text-[10px]">Contact: {hospital.email}</p>
                                        {distToPatient && (
                                            <p className="text-[10px] text-gray-500 mt-1">
                                                Distance to Patient: <span className="text-white font-bold font-mono">{distToPatient} km</span>
                                            </p>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
        
                    {/* Route Line */}
                    {hasValidAmbulanceCoords && hasValidPatientCoords && routeCoordinates.length > 0 && (
                        <Polyline 
                            positions={routeCoordinates} 
                            pathOptions={{ color: "#ef4444", weight: 5, opacity: 0.8 }}
                        />
                    )}
                </MapContainer>
            </div>
        </div>
    );
}

export default MapComponent;