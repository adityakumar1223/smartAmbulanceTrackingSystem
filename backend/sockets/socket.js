const jwt = require("jsonwebtoken");
const User = require("../models/user.js");
const radarService = require("../services/radarService.js");

let io;
const activeUsers = new Map();

const initializeSocket = (serverIo) => {
    io = serverIo;

    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);

        // Register user via query param (on initial connect)
        const userId = socket.handshake.query?.userId;
        if (userId) {
            activeUsers.set(userId.toString(), socket.id);
            console.log(`Mapped user ${userId} to socket ${socket.id} (query param)`);
        }

        socket.on("register", (uId) => {
            if (uId) {
                activeUsers.set(uId.toString(), socket.id);
                console.log(`Registered user ${uId} to socket ${socket.id} (register event)`);
            }
        });

        // FIX #13: Authenticate driverLocationUpdate with a JWT token in the payload
        // This prevents any anonymous socket from spoofing another driver's GPS position.
        socket.on("driverLocationUpdate", async (data) => {
            try {
                const { driverId, lat, lng, token } = data;

                if (!token) {
                    return console.warn(`[Security] driverLocationUpdate from ${socket.id} rejected: no token provided`);
                }

                let decoded;
                try {
                    decoded = jwt.verify(token, process.env.JWT_SECRET);
                } catch (jwtErr) {
                    return console.warn(`[Security] driverLocationUpdate from ${socket.id} rejected: invalid token`);
                }

                // The token's subject must match the driverId in the payload
                if (decoded.id.toString() !== driverId?.toString()) {
                    return console.warn(`[Security] driverLocationUpdate rejected: token user '${decoded.id}' ≠ claimed driverId '${driverId}'`);
                }

                console.log("Authenticated Driver Location Update", { driverId, lat, lng });
                io.emit("driverLocationUpdated", { driverId, lat, lng });

                if (driverId && lat !== undefined && lng !== undefined) {
                    const user = await User.findById(driverId);
                    if (user && !user.isManualOverride) {
                        user.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
                        user.currentLocation = { type: "Point", coordinates: [Number(lng), Number(lat)] };
                        await user.save();
                        await radarService.syncDriverLocation(driverId, Number(lat), Number(lng));
                    }
                }
            } catch (err) {
                console.error("Error processing driverLocationUpdate:", err);
            }
        });

        socket.on("patientLocationUpdate", (data) => {
            console.log("Live Patient Location", data);
            io.emit("patientLocationUpdated", data);
        });

        // FIX #13: Also authenticate manual_location_update
        socket.on("manual_location_update", async (data) => {
            try {
                const { userId: uId, latitude, longitude, token } = data;

                if (!uId || latitude === undefined || longitude === undefined) {
                    return console.warn("Invalid manual_location_update payload");
                }

                if (!token) {
                    return console.warn(`[Security] manual_location_update from ${socket.id} rejected: no token`);
                }

                let decoded;
                try {
                    decoded = jwt.verify(token, process.env.JWT_SECRET);
                } catch {
                    return console.warn(`[Security] manual_location_update from ${socket.id} rejected: invalid token`);
                }

                if (decoded.id.toString() !== uId?.toString()) {
                    return console.warn(`[Security] manual_location_update rejected: token mismatch`);
                }

                const lat = Number(latitude);
                const lng = Number(longitude);
                if (isNaN(lat) || isNaN(lng)) {
                    return console.warn("Invalid manual_location_update coordinates");
                }

                await User.findByIdAndUpdate(uId, {
                    location: { type: "Point", coordinates: [lng, lat] },
                    currentLocation: { type: "Point", coordinates: [lng, lat] },
                    isManualOverride: true,
                    isManualLocation: true
                });
                console.log(`Manual location update saved for user ${uId}: [${lng}, ${lat}]`);

                await radarService.syncDriverLocation(uId, lat, lng);

                io.emit("driver_location_updated", { driverId: uId, lat, lng });
                io.emit("driverLocationUpdated", { driverId: uId, lat, lng });

            } catch (err) {
                console.error("Error saving manual location update:", err);
            }
        });

        socket.on("reset_location_override", async (data) => {
            try {
                const { userId: uId } = data;
                if (!uId) return console.warn("Invalid reset_location_override payload");

                await User.findByIdAndUpdate(uId, {
                    isManualOverride: false,
                    isManualLocation: false
                });
                console.log(`Manual location override reset for user ${uId}`);

                io.emit("location_override_reset", { driverId: uId });
            } catch (err) {
                console.error("Error resetting location override:", err);
            }
        });

        socket.on("disconnect", () => {
            for (const [uId, sId] of activeUsers.entries()) {
                if (sId === socket.id) {
                    activeUsers.delete(uId);
                    console.log(`Unregistered user ${uId} from socket ${socket.id}`);
                    break;
                }
            }
        });
    });
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};

const getUserSocketIds = (userIds) => {
    if (!userIds) return [];
    if (!Array.isArray(userIds)) {
        userIds = [userIds];
    }
    const ids = [];
    for (const id of userIds) {
        if (id) {
            const socketId = activeUsers.get(id.toString());
            if (socketId) {
                ids.push(socketId);
            }
        }
    }
    return ids;
};

module.exports = { initializeSocket, getIo, getUserSocketIds, activeUsers };