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


function MapComponent(){

    const patientLocation = {
     lat: 25.610,
    lng: 85.158,
    };

    const [ambulanceLocation, setAmbulanceLocation] = useState({
    lat: 25.591,
    lng: 85.1376
    });

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

    // ORS use effect
    useEffect(() => {
        const fetchRoute = async () => {

            try {

                const response = await fetch(

                    `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${
                        import.meta.env.VITE_ORS_API_KEY
                    }&start=${
                        ambulanceLocation.lng
                    },${
                        ambulanceLocation.lat
                    },&end=${
                        patientLocation.lng
                    },${
                        patientLocation.lat
                    }`   
                );

                const data = await response.json();

                const summary = data.features[0].properties.summary

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
                

                if (!data.features) {
                      console.log("No route found");
                        return;
                    }

                console.log(data);

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

    },[ambulanceLocation]);

    return ( 
        <>
        <h1>Map Working</h1>
        <div
            style = {{
                padding: "10px",
                background: "white",
                position: "absolute",
                zIndex: 1000,
                left: 10,
                top: 10,
                borderRadius: "10px",
            }} >
            
            <h3>ETA: {eta} mins</h3>
            <h3>Distance: {distance} km</h3>
            <h3>Traffic Level: {trafficLevel}</h3>
        </div>
            <MapContainer
            center = {ambulanceLocation}
            zoom = {13}
            style = {{
                height: "100vh",
                width: "100%",
            }} >

                <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Ambulance marker */}
                <Marker position={ambulanceLocation}>
                <Popup>
                    Ambulance
                </Popup>
                </Marker>

                {/* Patient marker */}
                <Marker position={patientLocation}>
                    <Popup>
                        Patient
                    </Popup>
                </Marker>

                {/* Route Line */}
                <Polyline 
                positions={routeCoordinates} 
                />

            </MapContainer>
            </>

    );
}

export default MapComponent;