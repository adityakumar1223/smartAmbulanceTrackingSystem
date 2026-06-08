import {
    createContext,
    useContext,
    useEffect,
    useState
} from 'react';

import api from '../services/api.js';
import socket from '../socket/socket.js';

const EmergencyContext = createContext();

export const EmergencyProvider = ({children}) => {

    const [activeEmergency, setActiveEmergency] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [loading, setLoading] = useState(false);

    //creating emergency
    const createEmergency = async (emergencyData) => {
        
        try {

            setLoading(true);
            const response = await api.post(
                "/emergency/request",
                emergencyData
            );

            setActiveEmergency(response.data.request || response.data);
            return response.data.request || response.data;

        } catch (error) {
            console.log(
                "Create Emergency Error",
                error
            );

            throw error;
        }

        finally {
            setLoading(false);
        }
    };


    // Accept Emergency

    const acceptEmergency = async (emergencyId) => {

        try {

            setLoading(true);
            const response = await api.put(
                `/emergency/accept/${emergencyId}`
            );

            setActiveEmergency(response.data.request || response.data);
            return response.data.request || response.data;
            
        } catch (error) {

            console.log(
                "Accept Emergency error",
                error
            );

            throw error;
            
        }
        finally {
            setLoading(false)

        };

    };

        //update status

        const updateEmergencyStatus = async (emergencyId, status) => {

            try {

                const response = await api.put(
                    `/emergency/updateStatus/${emergencyId}`,
                    {status}
                );

                setActiveEmergency(response.data.request || response.data);
                return response.data.request || response.data;
                
            } catch (error) {

                console.log(
                    "Update emergency error",
                    error
                );

                throw error;
                
            };
            
        };

        //socket listeners
        useEffect(() => {
            //driver location update
            socket.on(
                    "driverLocationUpdated",
                    (locationData) => {
                        setDriverLocation(locationData);
                    }
                );

                //emergency status updated
            socket.on(
                "emergencyStatusUpdated",
                (updatedEmergency) => {
                    setActiveEmergency(updatedEmergency);
                    }
                );

            //driver accepted request
            socket.on(
                "emergencyAccepted",
                (updatedEmergency) => {
                    setActiveEmergency(updatedEmergency);
                }
            );

            return () => {
                socket.off("driverLocationUpdated");
                socket.off("emergencyStatusUpdated");
                socket.off("emergencyAccepted");
            };
            
        }, []);


        //context value

        const value = {
            activeEmergency,
            setActiveEmergency,

            driverLocation,
            setDriverLocation,

            loading,

            createEmergency,
            acceptEmergency,
            updateEmergencyStatus,
        };


        return (
            <EmergencyContext.Provider value={value}>
                {children}
            </EmergencyContext.Provider>
        );        

    };
    export const useEmergency = () => {
        return useContext(EmergencyContext);
    };
    