import {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef
} from 'react';

import api from '../services/api.js';
import socket from '../socket/socket.js';
import { useAuth } from './AuthContext.jsx';

const EmergencyContext = createContext();

export const EmergencyProvider = ({children}) => {
    const { user, loading: authLoading } = useAuth();
    const [activeEmergency, setActiveEmergency] = useState(() => {
        try {
            const saved = localStorage.getItem("activeEmergency");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && !["completed", "cancelled"].includes(parsed.status)) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Failed to parse activeEmergency from localStorage:", e);
        }
        return null;
    });
    const [driverLocation, setDriverLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasCheckedActive, setHasCheckedActive] = useState(false);

    const activeEmergencyRef = useRef(activeEmergency);
    useEffect(() => {
        activeEmergencyRef.current = activeEmergency;
    }, [activeEmergency]);

    // Sync activeEmergency with localStorage
    useEffect(() => {
        if (activeEmergency) {
            if (["completed", "cancelled"].includes(activeEmergency.status)) {
                localStorage.removeItem("activeEmergency");
                setActiveEmergency(null);
            } else {
                localStorage.setItem("activeEmergency", JSON.stringify(activeEmergency));
            }
        } else {
            localStorage.removeItem("activeEmergency");
        }
    }, [activeEmergency]);

  // Sync driver location from activeEmergency object if available and not yet set
  useEffect(() => {
    if (activeEmergency && activeEmergency.driverId) {
      const driver = activeEmergency.driverId;
      if (driver.location && Array.isArray(driver.location.coordinates) && driver.location.coordinates.length >= 2) {
        setDriverLocation({
          lat: driver.location.coordinates[1],
          lng: driver.location.coordinates[0],
          driverId: driver._id || driver.id
        });
      } else if (driver.currentLocation && Array.isArray(driver.currentLocation.coordinates) && driver.currentLocation.coordinates.length >= 2) {
        setDriverLocation({
          lat: driver.currentLocation.coordinates[1],
          lng: driver.currentLocation.coordinates[0],
          driverId: driver._id || driver.id
        });
      }
    } else if (!activeEmergency) {
      setDriverLocation(null);
    }
  }, [activeEmergency]);

    // Fallback sync with database if localStorage was empty on start
    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user) {
            setActiveEmergency(null);
            localStorage.removeItem("activeEmergency");
            setHasCheckedActive(false);
            return;
        }

        const fetchActiveEmergency = async () => {
            if (!activeEmergency && !hasCheckedActive) {
                try {
                    const response = await api.get("/emergency/active");
                    if (response.data && response.data.request) {
                        setActiveEmergency(response.data.request);
                    }
                } catch (error) {
                    console.error("Failed to fetch active emergency request:", error);
                } finally {
                    setHasCheckedActive(true);
                }
            } else {
                setHasCheckedActive(true);
            }
        };

        fetchActiveEmergency();
    }, [user, authLoading, hasCheckedActive]);

  // FIX #22: The 5-second polling interval has been REMOVED.
  // At scale (100 patients) it generated 1,200 requests/minute on a single endpoint.
  // Real-time updates are handled exclusively by the socket listeners below:
  //   - "emergencyStatusUpdated" updates status for all roles
  //   - "emergencyAccepted" notifies the patient when a driver accepts
  // This eliminates the polling overhead entirely.

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

        const updateEmergencyStatus = async (emergencyId, status, customCoordinates = null) => {

            try {

                let response;
                if (status === "in_transit" || status === "boarded") {
                    let coordinates = customCoordinates;
                    if (!coordinates && driverLocation && typeof driverLocation.lat === "number" && typeof driverLocation.lng === "number") {
                        coordinates = [driverLocation.lng, driverLocation.lat];
                    }
                    response = await api.put(
                        `/emergency/boarded/${emergencyId}`,
                        { coordinates }
                    );
                } else {
                    response = await api.put(
                        `/emergency/updateStatus/${emergencyId}`,
                        { status }
                    );
                }

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

        const cancelEmergency = async (emergencyId) => {
            try {
                setLoading(true);
                const response = await api.put(`/emergency/cancel/${emergencyId}`);
                setActiveEmergency(response.data.request || response.data);
                return response.data.request || response.data;
            } catch (error) {
                console.error("Cancel Emergency error", error);
                throw error;
            } finally {
                setLoading(false);
            }
        };

        const connectToNextDriver = async (emergencyId) => {
            try {
                setLoading(true);
                const response = await api.put(`/emergency/next-driver/${emergencyId}`);
                setActiveEmergency(response.data.request || response.data);
                return response.data.request || response.data;
            } catch (error) {
                console.error("Connect to next driver error:", error);
                throw error;
            } finally {
                setLoading(false);
            }
        };

        //socket listeners
        useEffect(() => {
            const handleDriverLocation = (locationData) => {
                const activeEmergencyObj = activeEmergencyRef.current;
                if (activeEmergencyObj && activeEmergencyObj.driverId && locationData) {
                    const activeDriverId = activeEmergencyObj.driverId._id || activeEmergencyObj.driverId;
                    if (locationData.driverId && locationData.driverId.toString() === activeDriverId.toString()) {
                        setDriverLocation(locationData);
                    }
                }
            };

            const handleStatusUpdate = (updatedEmergency) => {
                setActiveEmergency(updatedEmergency);
            };

            const handleAccepted = (updatedEmergency) => {
                setActiveEmergency(updatedEmergency);
            };

            socket.on("driverLocationUpdated", handleDriverLocation);
            socket.on("emergencyStatusUpdated", handleStatusUpdate);
            socket.on("emergencyAccepted", handleAccepted);

            return () => {
                socket.off("driverLocationUpdated", handleDriverLocation);
                socket.off("emergencyStatusUpdated", handleStatusUpdate);
                socket.off("emergencyAccepted", handleAccepted);
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
            cancelEmergency,
            connectToNextDriver,
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
    