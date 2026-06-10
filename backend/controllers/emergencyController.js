const mongoose = require("mongoose");
const crypto = require("crypto");
const Chat = require("../models/Chat.js");
const emergencyRequest = require("../models/emergencyRequest.js");
const User = require("../models/user.js");
const bcrypt = require("bcryptjs");
const { getIo, getUserSocketIds } = require('../sockets/socket.js');
const { Groq } = require("groq-sdk");
const radarService = require("../services/radarService.js");

// Module-level singleton — avoids recreating the HTTP client on every request
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Find the nearest online drivers for a given pickup location.
// Uses Radar.io first, falls back to MongoDB $near with a 20 km cap.
// ─────────────────────────────────────────────────────────────────────────────
const getOnlineDriversForRequest = async (pickupLocation) => {
    const { activeUsers } = require('../sockets/socket.js');
    const onlineUserIds = Array.from(activeUsers.keys()).map(id => id.toString());

    if (onlineUserIds.length === 0) {
        return [];
    }

    let nearestDrivers = [];
    const [patientLng, patientLat] = pickupLocation.coordinates;

    try {
        const nearestRadarAmbulances = await radarService.findNearestAmbulances(patientLat, patientLng, 15);
        if (nearestRadarAmbulances && nearestRadarAmbulances.length > 0) {
            const onlineRadarIds = nearestRadarAmbulances
                .map(d => d.userId)
                .filter(id => onlineUserIds.includes(id.toString()));

            const rawDrivers = await User.find({
                _id: { $in: onlineRadarIds },
                role: "driver"
            });

            nearestDrivers = rawDrivers.sort((a, b) => {
                return onlineRadarIds.indexOf(a._id.toString()) - onlineRadarIds.indexOf(b._id.toString());
            }).slice(0, 5);
        }
    } catch (err) {
        console.error("Radar.io findNearestAmbulances failed, falling back to database query:", err);
    }

    if (!nearestDrivers || nearestDrivers.length === 0) {
        try {
            // FIX #21: Added $maxDistance: 20000 (20 km) — prevents matching drivers across the country
            nearestDrivers = await User.find({
                role: "driver",
                _id: { $in: onlineUserIds },
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: pickupLocation.coordinates
                        },
                        $maxDistance: 20000 // 20 km radius
                    }
                }
            }).limit(5);
        } catch (dbErr) {
            console.error("DB proximity search failed in getOnlineDriversForRequest:", dbErr);
        }
    }

    // Supplementary Fallback: If we found fewer drivers than are online,
    // fetch other online drivers that were not matched by the proximity search (e.g. they are > 20km away or have no location).
    if (nearestDrivers.length < onlineUserIds.length) {
        const foundIds = nearestDrivers.map(d => d._id.toString());
        const remainingIds = onlineUserIds.filter(id => !foundIds.includes(id));
        if (remainingIds.length > 0) {
            try {
                const extraDrivers = await User.find({
                    role: "driver",
                    _id: { $in: remainingIds }
                }).limit(5 - nearestDrivers.length);
                nearestDrivers = nearestDrivers.concat(extraDrivers);
            } catch (err) {
                console.error("Failed to fetch extra online drivers:", err);
            }
        }
    }

    return nearestDrivers;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Sync the notifiedDrivers array with the current set of online drivers.
// FIX #16: Only appends new online drivers, never shrinks the array, so a driver
// who just accepted is not silently removed from the list.
// ─────────────────────────────────────────────────────────────────────────────
const updateNotifiedDrivers = async (request) => {
    if (!request || ["completed", "cancelled"].includes(request.status) || !request.pickupLocation || !request.pickupLocation.coordinates) {
        return request;
    }
    const onlineDrivers = await getOnlineDriversForRequest(request.pickupLocation);
    if (onlineDrivers.length > 0) {
        // FIX #16: Use $addToSet semantics — merge new drivers in rather than overwriting
        const existingIds = (request.notifiedDrivers || []).map(id => id.toString());
        const newIds = onlineDrivers.map(d => d._id);
        const merged = [...existingIds];
        newIds.forEach(id => {
            if (!merged.includes(id.toString())) merged.push(id);
        });
        request.notifiedDrivers = merged;
        await request.save();
    }
    return request;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: When a driver comes online, try to match them to a nearby pending request.
// FIX #7: Now uses proximity search so only geographically relevant requests are matched.
// FIX #6: Uses atomic findOneAndUpdate to prevent double-assignment race conditions.
// ─────────────────────────────────────────────────────────────────────────────
const autoMatchPendingRequestForDriver = async (driverId) => {
    try {
        // Get this driver's current location first
        const driver = await User.findById(driverId).select("location currentLocation role");
        if (!driver || driver.role !== "driver") return;

        const driverLocation =
            (driver.location?.coordinates?.length >= 2 && (driver.location.coordinates[0] !== 0 || driver.location.coordinates[1] !== 0))
                ? driver.location
                : (driver.currentLocation?.coordinates?.length >= 2 && (driver.currentLocation.coordinates[0] !== 0 || driver.currentLocation.coordinates[1] !== 0))
                    ? driver.currentLocation
                    : null;

        if (!driverLocation) {
            console.warn(`[Auto-Match] Driver ${driverId} has no location data. Skipping.`);
            return;
        }

        // FIX #7: Find nearby pending requests within 20 km, sorted by age (oldest first)
        const pendingRequests = await emergencyRequest.find({
            status: "pending",
            driverId: null,
            pickupLocation: {
                $near: {
                    $geometry: { type: "Point", coordinates: driverLocation.coordinates },
                    $maxDistance: 20000 // 20 km
                }
            }
        }).limit(1);

        if (!pendingRequests || pendingRequests.length === 0) {
            return; // No nearby pending requests
        }

        const request = pendingRequests[0];

        // FIX #6: Atomic update — prevents race condition where two drivers accept simultaneously
        const updated = await emergencyRequest.findOneAndUpdate(
            { _id: request._id, status: "pending", driverId: null },
            {
                $set: { status: "accepted", driverId: driverId },
                $addToSet: { notifiedDrivers: driverId }
            },
            { new: true }
        );

        if (!updated) {
            console.log(`[Auto-Match] Request ${request._id} was claimed by another driver simultaneously. Skipping.`);
            return;
        }

        const populatedRequest = await emergencyRequest.findById(updated._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        const io = getIo();
        io.emit("emergencyAccepted", populatedRequest);
        io.emit("emergencyStatusUpdated", populatedRequest);

        console.log(`[Auto-Match] Matched request ${request._id} to nearby driver ${driverId}`);
    } catch (err) {
        console.error("Auto-match pending request failed:", err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE EMERGENCY REQUEST
// ─────────────────────────────────────────────────────────────────────────────
const createEmergencyRequest = async (req, res) => {
    try {
        const { emergencyType, pickupLocation, patientNotes } = req.body;

        if (!emergencyType || !pickupLocation || !pickupLocation.coordinates) {
            return res.status(400).json({ message: "emergencyType and pickupLocation are required." });
        }

        const nearestDrivers = await getOnlineDriversForRequest(pickupLocation);
        const driverIds = nearestDrivers.map(d => d._id);
        const autoDriverId = driverIds.length > 0 ? driverIds[0] : null;
        const autoStatus = driverIds.length > 0 ? "accepted" : "pending";

        const request = await emergencyRequest.create({
            patientId: req.user.id,
            emergencyType,
            pickupLocation,
            patientNotes: patientNotes || "",
            notifiedDrivers: driverIds,
            driverId: autoDriverId,
            status: autoStatus
        });

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        const socketIds = getUserSocketIds(driverIds);
        const io = getIo();
        socketIds.forEach(socketId => {
            io.to(socketId).emit("new_emergency_request", populatedRequest);
            io.to(socketId).emit("emergencyRequest", populatedRequest);
        });

        io.emit("emergencyStatusUpdated", populatedRequest);
        if (autoDriverId) {
            io.emit("emergencyAccepted", populatedRequest);
        }

        res.status(201).json({
            message: "Emergency request created",
            request: populatedRequest,
            notifiedDriversCount: nearestDrivers.length
        });
    } catch (error) {
        console.error("Create emergency error:", error);
        res.status(500).json({ message: "Failed to create emergency request." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL EMERGENCY REQUESTS (admin/hospital)
// ─────────────────────────────────────────────────────────────────────────────
const getAllEmergencyRequest = async (req, res) => {
    try {
        const requests = await emergencyRequest.find()
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation");

        res.status(200).json({ requests });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch emergency requests." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PENDING REQUESTS FOR A DRIVER
// ─────────────────────────────────────────────────────────────────────────────
const getAllPendingRequest = async (req, res) => {
    try {
        const requests = await emergencyRequest.find({
            status: "pending",
            notifiedDrivers: req.user.id
        }).populate("patientId", "name email role");

        res.status(200).json({ requests });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch pending requests." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPT EMERGENCY REQUEST
// FIX #6: Atomic findOneAndUpdate prevents the race condition where two drivers
// simultaneously read status:"pending" and both write status:"accepted".
// ─────────────────────────────────────────────────────────────────────────────
const acceptEmergencyRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const driverId = req.user.id;

        // Atomic: only succeeds if the request is still "pending" at the moment of update
        const request = await emergencyRequest.findOneAndUpdate(
            { _id: requestId, status: "pending" },
            { $set: { status: "accepted", driverId: driverId } },
            { new: true }
        );

        if (!request) {
            // Either the request doesn't exist or was already accepted by another driver
            return res.status(409).json({
                message: "This emergency has already been accepted by another driver or does not exist.",
            });
        }

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        const io = getIo();
        io.emit("emergencyAccepted", populatedRequest);
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({
            message: "Emergency request accepted",
            request: populatedRequest,
        });

    } catch (error) {
        console.error("Accept emergency request error:", error);
        res.status(500).json({ message: "Failed to accept emergency request." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE EMERGENCY STATUS
// FIX #24: Driver must own the request before they can update its status.
// ─────────────────────────────────────────────────────────────────────────────
const updateEmergencyStatus = async (req, res) => {
    const validStatuses = [
        "pending", "accepted", "on_the_way", "arrived",
        "boarded", "in_transit", "completed", "cancelled"
    ];

    try {
        const requestId = req.params.id;
        const { status } = req.body;

        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Emergency request not found" });
        }

        // FIX #24: Verify the calling driver owns this request
        if (req.user.role === "driver" && request.driverId && request.driverId.toString() !== req.user.id) {
            return res.status(403).json({
                message: "You are not authorized to update the status of this emergency."
            });
        }

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value." });
        }

        request.status = status;
        await request.save();

        if (status === "completed" || status === "cancelled") {
            try {
                await Chat.deleteMany({ emergencyRequestId: new mongoose.Types.ObjectId(requestId) });
                console.log(`[AI Chat] Cleared chat history for finished emergency request ${requestId}`);
            } catch (chatErr) {
                console.error("[AI Chat] Failed to clear chat history on status update:", chatErr);
            }
        } else {
            // FIX #11: Only call updateNotifiedDrivers on genuine status changes,
            // NOT on the polling endpoint (getActiveEmergencyRequest)
            await updateNotifiedDrivers(request);
        }

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        const io = getIo();
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({ message: "Emergency status updated", request: populatedRequest });

    } catch (error) {
        console.error("Update status error:", error);
        res.status(500).json({ message: "Failed to update emergency status." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET DRIVER'S OWN REQUESTS
// ─────────────────────────────────────────────────────────────────────────────
const getDriverRequest = async (req, res) => {
    try {
        const requests = await emergencyRequest.find({ driverId: req.user.id })
            .populate("patientId", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({ requests });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch driver requests." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ANONYMOUS SOS EMERGENCY
// FIX #8: Now uses proximity-based driver selection (same as regular requests).
// FIX #8: System user password is now randomly generated (not hardcoded).
// FIX #15: SOS request is now properly routed to nearest drivers.
// ─────────────────────────────────────────────────────────────────────────────
const createAnonymousSOSEmergency = async (req, res) => {
    try {
        const { pickupLocation } = req.body;

        if (!pickupLocation || !Array.isArray(pickupLocation.coordinates) || pickupLocation.coordinates.length < 2) {
            return res.status(400).json({ message: "Valid pickup coordinates are required for SOS dispatch." });
        }

        // Validate coordinate ranges
        const [lng, lat] = pickupLocation.coordinates;
        if (isNaN(lng) || isNaN(lat) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ message: "Invalid coordinates provided." });
        }

        // FIX #8: System SOS user uses a random password (not hardcoded)
        let anonymousUser = await User.findOne({ email: "sos@system.local" });
        if (!anonymousUser) {
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const hashedPassword = await bcrypt.hash(randomPassword, 12);
            anonymousUser = await User.create({
                name: "Anonymous SOS Caller",
                email: "sos@system.local",
                username: "anonymous_sos",
                password: hashedPassword,
                role: "patient"
            });
        }

        // FIX #15: Use the same proximity logic as regular emergency requests
        const nearestDrivers = await getOnlineDriversForRequest(pickupLocation);
        const driverIds = nearestDrivers.map(d => d._id);
        const autoDriverId = driverIds.length > 0 ? driverIds[0] : null;
        const autoStatus = driverIds.length > 0 ? "accepted" : "pending";

        const request = await emergencyRequest.create({
            patientId: anonymousUser._id,
            emergencyType: "Severe_Bleeding",
            pickupLocation,
            patientNotes: "EMERGENCY SOS: Triggered anonymously from login screen.",
            notifiedDrivers: driverIds,
            driverId: autoDriverId,
            status: autoStatus
        });

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation");

        const io = getIo();
        // Notify the nearest drivers specifically, plus broadcast for dashboards
        const socketIds = getUserSocketIds(driverIds);
        socketIds.forEach(socketId => {
            io.to(socketId).emit("new_emergency_request", populatedRequest);
        });
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(201).json({
            message: "SOS Emergency dispatch created successfully",
            request: populatedRequest,
        });

    } catch (error) {
        console.error("SOS Emergency request error:", error);
        res.status(500).json({ message: "SOS dispatch failed. Please call emergency services directly." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL ANONYMOUS SOS EMERGENCY
// ─────────────────────────────────────────────────────────────────────────────
const cancelAnonymousSOSEmergency = async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Emergency request not found" });
        }

        request.status = "cancelled";
        await request.save();

        try {
            await Chat.deleteMany({ emergencyRequestId: new mongoose.Types.ObjectId(requestId) });
            console.log(`[AI Chat] Cleared chat history for cancelled SOS: ${requestId}`);
        } catch (chatErr) {
            console.error("[AI Chat] Failed to clear chat history on SOS cancellation:", chatErr);
        }

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        const io = getIo();
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({ message: "SOS Emergency cancelled successfully", request: populatedRequest });
    } catch (error) {
        res.status(500).json({ message: "Failed to cancel SOS emergency." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STATUS TO BOARDED (finds nearest hospital & sets route)
// ─────────────────────────────────────────────────────────────────────────────
const updateStatusToBoarded = async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Emergency request not found." });
        }

        let driverCoords = null;
        if (req.body.coordinates && Array.isArray(req.body.coordinates) && req.body.coordinates.length >= 2) {
            driverCoords = req.body.coordinates;
        } else {
            const driver = await User.findById(request.driverId || req.user.id);
            if (driver?.location?.coordinates?.length >= 2) {
                driverCoords = driver.location.coordinates;
            } else if (driver?.currentLocation?.coordinates?.length >= 2) {
                driverCoords = driver.currentLocation.coordinates;
            }
        }

        if (!driverCoords || (driverCoords[0] === 0 && driverCoords[1] === 0)) {
            driverCoords = request.pickupLocation.coordinates;
        }

        const nearestHospital = await User.findOne({
            role: "hospital",
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: driverCoords }
                }
            }
        });

        if (!nearestHospital) {
            return res.status(404).json({ message: "No nearest hospital found. Please seed hospitals in the database." });
        }

        request.status = "in_transit";
        request.dropoffLocation = {
            type: "Point",
            coordinates: nearestHospital.location.coordinates
        };
        await request.save();

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        const io = getIo();
        const userSocketIds = getUserSocketIds([request.patientId, request.driverId]);

        userSocketIds.forEach(socketId => {
            io.to(socketId).emit("route_to_hospital", {
                requestId: request._id,
                hospital: {
                    id: nearestHospital._id,
                    name: nearestHospital.name,
                    email: nearestHospital.email,
                    coordinates: nearestHospital.location.coordinates
                },
                driverLocation: { lat: driverCoords[1], lng: driverCoords[0] }
            });
        });

        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({
            message: "Emergency status updated to in_transit",
            request: populatedRequest,
            hospital: nearestHospital
        });

    } catch (error) {
        console.error("Error updating status to boarded:", error);
        res.status(500).json({ message: "Failed to update status to in_transit." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ACTIVE EMERGENCY REQUEST
// FIX #11: Removed updateNotifiedDrivers() from this polling endpoint.
// It was firing a Radar API call + DB geospatial query + save on every 5-second poll.
// Driver sync now only happens on explicit status-change events.
// FIX #32: Single findOne query instead of two separate queries.
// ─────────────────────────────────────────────────────────────────────────────
const getActiveEmergencyRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let query = {};
        if (role === "patient") {
            query = {
                patientId: userId,
                status: { $in: ["pending", "accepted", "on_the_way", "arrived", "boarded", "in_transit"] }
            };
        } else if (role === "driver") {
            query = {
                driverId: userId,
                status: { $in: ["accepted", "on_the_way", "arrived", "boarded", "in_transit"] }
            };
        } else {
            return res.status(400).json({ message: "Role is not eligible for active emergency requests." });
        }

        // FIX #32: Single query — no second findOne after updateNotifiedDrivers
        const populatedRequest = await emergencyRequest.findOne(query)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        res.status(200).json({ request: populatedRequest || null });
    } catch (error) {
        console.error("Error fetching active emergency:", error);
        res.status(500).json({ message: "Failed to fetch active emergency." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL EMERGENCY REQUEST (patient)
// ─────────────────────────────────────────────────────────────────────────────
const cancelEmergencyRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Emergency request not found." });
        }

        if (request.patientId.toString() !== req.user.id) {
            return res.status(403).json({ message: "You are not authorized to cancel this request." });
        }

        request.status = "cancelled";
        await request.save();

        try {
            await Chat.deleteMany({ emergencyRequestId: new mongoose.Types.ObjectId(requestId) });
            console.log(`[AI Chat] Cleared chat history for cancelled emergency ${requestId}`);
        } catch (chatErr) {
            console.error("[AI Chat] Failed to clear chat history on cancellation:", chatErr);
        }

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email")
            .populate("notifiedDrivers", "name email");

        const io = getIo();
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({ message: "Emergency request cancelled successfully", request: populatedRequest });
    } catch (error) {
        console.error("Error cancelling emergency:", error);
        res.status(500).json({ message: "Failed to cancel emergency request." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// AI SCENE ANALYSIS (image upload)
// ─────────────────────────────────────────────────────────────────────────────
const aiProcessEmergencyScene = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                message: `Unsupported file type: ${req.file.mimetype}. Please upload a JPEG, PNG, WEBP, or GIF image.`
            });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ message: "AI service is not configured. Please contact support." });
        }

        const base64Image = req.file.buffer.toString("base64");
        const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

        const response = await groq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            response_format: { type: "json_object" },
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "You are an emergency response AI. Analyze this image of an emergency scene and return a JSON object with: { \"description\": string, \"severity\": \"low\" | \"medium\" | \"high\", \"estimated_victims\": number, \"suggested_ambulance_type\": string }."
                    },
                    { type: "image_url", image_url: { url: dataUrl } }
                ]
            }],
            max_completion_tokens: 1024
        });

        const content = response.choices[0].message.content;
        let aiData;
        if (typeof content === "string") {
            try { aiData = JSON.parse(content); } catch (e) {
                return res.status(500).json({ message: "Failed to parse AI response." });
            }
        } else if (typeof content === "object" && content !== null) {
            aiData = content;
        } else {
            return res.status(500).json({ message: "AI returned an unexpected response format." });
        }

        if (!aiData.description) {
            return res.status(422).json({
                message: "AI could not generate a description. Please try another image or fill the form manually.",
                data: aiData
            });
        }

        res.status(200).json({ success: true, data: aiData });

    } catch (error) {
        console.error("AI processing error:", error);
        res.status(500).json({ message: "AI Processing failed. Please try again." });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONNECT TO NEXT DRIVER
// FIX #28: Now sends a targeted `new_emergency_request` event to the newly assigned
// driver's socket so they receive a push notification for the reassigned request.
// ─────────────────────────────────────────────────────────────────────────────
const connectToNextDriver = async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: "Emergency request not found" });
        }

        const onlineDrivers = await getOnlineDriversForRequest(request.pickupLocation);
        const isPending = request.status === "pending" || !request.driverId;

        if (!onlineDrivers || onlineDrivers.length === 0) {
            return res.status(400).json({
                message: "No online ambulances were found nearby. Please wait or call emergency services directly."
            });
        }

        const currentDriverId = request.driverId ? request.driverId.toString() : null;
        const alternativeDrivers = onlineDrivers.filter(d => d._id.toString() !== currentDriverId);

        // When switching from an already-assigned driver we need at least one alternative driver online.
        if (!isPending && alternativeDrivers.length === 0) {
            return res.status(400).json({
                message: "No other online ambulances were found nearby to switch to."
            });
        }
        let nextIndex = 0;

        if (currentDriverId) {
            const currentIndex = onlineDrivers.findIndex(d => d._id.toString() === currentDriverId);
            if (currentIndex !== -1) {
                nextIndex = (currentIndex + 1) % onlineDrivers.length;
            }
        }
        // If pending (no current driver), nextIndex stays 0 — picks the nearest driver

        const oldDriverId = request.driverId;
        const newDriverId = onlineDrivers[nextIndex]._id;

        request.driverId = newDriverId;
        request.status = "accepted";
        request.notifiedDrivers = onlineDrivers.map(d => d._id);
        await request.save();

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email location currentLocation isManualOverride isManualLocation")
            .populate("notifiedDrivers", "name email");

        const io = getIo();
        io.emit("emergencyStatusUpdated", populatedRequest);
        io.emit("emergencyAccepted", populatedRequest);

        // FIX #28: Notify the *new* driver specifically with a targeted push
        const newDriverSocketIds = getUserSocketIds([newDriverId]);
        newDriverSocketIds.forEach(socketId => {
            io.to(socketId).emit("new_emergency_request", populatedRequest);
            io.to(socketId).emit("emergencyRequest", populatedRequest);
        });

        // Notify the old driver that the request has been reassigned (clears their dashboard)
        if (oldDriverId) {
            const oldDriverSocketIds = getUserSocketIds([oldDriverId]);
            oldDriverSocketIds.forEach(socketId => {
                io.to(socketId).emit("emergencyStatusUpdated", {
                    _id: request._id,
                    status: "cancelled",
                    clearedBySwitch: true
                });
            });
        }

        res.status(200).json({
            message: "Successfully connected to the nearest available ambulance",
            request: populatedRequest
        });
    } catch (error) {
        console.error("Connect to next driver error:", error);
        res.status(500).json({ message: "Failed to switch to next driver." });
    }
};


module.exports = {
    createEmergencyRequest,
    getAllEmergencyRequest,
    acceptEmergencyRequest,
    getAllPendingRequest,
    updateEmergencyStatus,
    getDriverRequest,
    createAnonymousSOSEmergency,
    cancelAnonymousSOSEmergency,
    updateStatusToBoarded,
    getActiveEmergencyRequest,
    cancelEmergencyRequest,
    aiProcessEmergencyScene,
    connectToNextDriver,
    getOnlineDriversForRequest,
    updateNotifiedDrivers,
    autoMatchPendingRequestForDriver
};