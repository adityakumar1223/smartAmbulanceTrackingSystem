import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import { useEffect, useState } from 'react';
import socket from '../../socket/socket';


function MapComponent({pickupLocation, driverLocation, dropoffLocation}){

    const patientLocation = (pickupLocation && Array.isArray(pickupLocation.coordinates) && pickupLocation.coordinates.length >= 2) ? {
        lat: Number(pickupLocation.coordinates[1]),
        lng: Number(pickupLocation.coordinates[0])
     } : null;

    const [ambulanceLocation, setAmbulanceLocation] = useState(driverLocation || {
        lat: 25.591,
        lng: 85.1376
    });

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

    const [eta, setEta] = useState(null);
    const [distance, setDistance] = useState(null);
    const [trafficLevel, setTrafficLevel] = useState("");

    const [routeCoordinates, setRouteCoordinates] = useState([]);

    // Socket Listener
    useEffect(() => {

  socket.on("driverLocationUpdated", (data) => {

    console.log("Location updated", data);

    setAmbulanceLocation({
      lat: data.lat,
      lng: data.lng,
    });

  });



  return () => {

    socket.off("driverLocationUpdated");

  };

}, []);

    useEffect(() => {
        if(driverLocation){
            setAmbulanceLocation(driverLocation);
        }
    }, [driverLocation]);

    // ORS use effect
    useEffect(() => {
        const fetchRoute = async () => {

            try {

                if (!hasValidPatientCoords || !hasValidAmbulanceCoords) return;
                const response = await fetch(

                    `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${
                        import.meta.env.VITE_ORS_API_KEY
                    }&start=${
                        ambulanceLocation.lng
                    },${
                        ambulanceLocation.lat
                    }&end=${
                        patientLocation.lng
                    },${
                        patientLocation.lat
                    }`   
                );

                const data = await response.json();

                if (!data || !data.features || data.features.length === 0) {
                      console.log("No route found");
                      return;
                }

                const summary = data.features[0].properties.summary;

                const distanceKm = (summary.distance / 1000).toFixed(2);

                const durationMin = (summary.duration / 60).toFixed(0);

                setDistance(distanceKm);
                setEta(durationMin);

                if(durationMin <= 10){
                    setTrafficLevel("Low");
                }else if( durationMin <=20 ){
                    setTrafficLevel("Moderate");
                }else{
                    setTrafficLevel("High");
                }

                const coordinates = data.features[0].geometry.coordinates.map(
                    (coord) => [
                        coord[1],
                        coord[0],
                    ]
                );

                setRouteCoordinates(coordinates);

                
            } catch (error) {
                console.log(
                    "Route error:",
                    error
                );
            }
            
        };

        fetchRoute();

    }, [ambulanceLocation, patientLocation, hasValidAmbulanceCoords, hasValidPatientCoords]);

    return ( 
        <div style={{ position: "relative", width: "100%", height: "65vh" }}>
        
        {/* Glassmorphic Diagnostics Console */}
        <div
            style = {{
                padding: "15px",
                background: "rgba(22, 26, 35, 0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                position: "absolute",
                zIndex: 1000,
                left: 20,
                top: 20,
                borderRadius: "20px",
                color: "#e5e7eb",
                boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.7)",
                width: "220px",
                fontFamily: "sans-serif"
            }} >
            
            <h3 style={{ margin: "0 0 5px 0", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.08em" }}>Route Diagnostics</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                    <span style={{ color: "#6b7280" }}>ETA:</span>
                    <span style={{ color: "#f3f4f6", fontWeight: "bold" }}>{eta ? `${eta} mins` : "Calculating..."}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                    <span style={{ color: "#6b7280" }}>Distance:</span>
                    <span style={{ color: "#f3f4f6", fontWeight: "bold" }}>{distance ? `${distance} km` : "Calculating..."}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                    <span style={{ color: "#6b7280" }}>Traffic Status:</span>
                    <span style={{
                        color: trafficLevel === "Low" ? "#10b981" : trafficLevel === "Moderate" ? "#f59e0b" : trafficLevel === "High" ? "#ef4444" : "#f3f4f6",
                        fontWeight: "bold",
                        background: trafficLevel === "Low" ? "rgba(16, 185, 129, 0.1)" : trafficLevel === "Moderate" ? "rgba(245, 158, 11, 0.1)" : trafficLevel === "High" ? "rgba(239, 68, 68, 0.1)" : "transparent",
                        padding: "2px 6px",
                        borderRadius: "6px"
                    }}>{trafficLevel || "Analyzing..."}</span>
                </div>
            </div>
        </div>

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
                    <Marker position={[
                         ambulanceLocation.lat,
                         ambulanceLocation.lng
                      ]}>
                        <Popup>
                            Ambulance (Live)
                        </Popup>
                    </Marker>
                )}

                {/* Patient marker */}
                {hasValidPatientCoords && (
                    <Marker
                        position={[
                            patientLocation.lat,
                            patientLocation.lng
                        ]} >
                        <Popup>Patient Location</Popup>
                    </Marker>
                )}

                {/* Route Line */}
                {hasValidAmbulanceCoords && hasValidPatientCoords && routeCoordinates.length > 0 && (
                    <Polyline 
                        positions={routeCoordinates} 
                        pathOptions={{ color: "#ef4444", weight: 5, opacity: 0.8 }}
                    />
                )}

            </MapContainer>
        </div>
    );
}

export default MapComponent;