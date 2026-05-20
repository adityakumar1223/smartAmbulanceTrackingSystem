import { useEffect } from "react";
import socket from "../../socket/socket.js";
import LogoutButton from "../../components/LogoutButton.jsx";




function DriverDashboard() {

    useEffect(()=>{

        if(navigator.geolocation){
            navigator.geolocation.watchPosition((position) => {
                const locationData = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                console.log("Driver Location: ",locationData);

                socket.emit(
                    "Driver Location upadte: ",
                    locationData
                );
            },
            (error) => {
                console.log(error);
            },
            {
                enableHighAccuracy: true,
            }
        );


        }
        
    }, []);

    return (
        <div>
        <h1>Driver Dashboard</h1>
        <LogoutButton/>
        </div>
    );
}

export default DriverDashboard;