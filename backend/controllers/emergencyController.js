const emergencyRequest = require("../models/emergencyRequest.js");
const User = require("../models/user.js");
const { getIo } = require('../sockets/socket.js');

const createEmergencyRequest = async (req, res) => {
    try {
        const { emergencyType, pickupLocation, patientNotes } = req.body;

        const request = await emergencyRequest.create({
            patientId: req.user.id,
            emergencyType,
            pickupLocation,
            patientNotes: patientNotes || ""
        });

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role");

        const io = getIo();
        io.emit("emergencyRequest", populatedRequest);

        res.status(201).json({
            message: "Emergency request created",
            request: populatedRequest,
        });
                
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const getAllEmergencyRequest = async (req, res) => {
    try {
        const requests = await emergencyRequest.find()
            .populate("patientId", "name email role")
            .populate("driverId", "name email");

        res.status(200).json({
            requests,
        });
        
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const getAllPendingRequest = async (req, res) => {
    try {
        const requests = await emergencyRequest.find({
            status: "pending",
        }).populate("patientId", "name email role");

        res.status(200).json({
            requests
        });

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const acceptEmergencyRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({
                message: "Emergency request not found",
            });
        }

        // Preventing accepting already accepted/completed requests
        if (request.status !== "pending") {
            return res.status(400).json({
                message: "Request already accepted or processed",
                request
            });
        }

        request.status = "accepted";
        request.driverId = req.user.id;

        await request.save();

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email");

        const io = getIo();
        // Emit events so both the patient and other drivers get the status update in real time
        io.emit("emergencyAccepted", populatedRequest);
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({
            message: "Emergency request accepted",
            request: populatedRequest,
        });
        
    } catch (error) {
        console.error("Accept emergency request error:", error);
        res.status(500).json({
            message: error.message,
        });
    }
};

const updateEmergencyStatus = async (req, res) => {
    const validStatuses = [
        "pending",
        "accepted",
        "on_the_way",
        "arrived",
        "completed",
        "cancelled"
    ];

    try {
        const requestId = req.params.id;
        const { status } = req.body;

        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({
                message: "Emergency request not found"
            });
        }

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid status",
            });
        }

        request.status = status;
        await request.save();

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email");

        const io = getIo();
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({
            message: "Emergency status updated",
            request: populatedRequest
        });
        
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

const getDriverRequest = async (req, res) => {
    try {
        const requests = await emergencyRequest.find({
            driverId: req.user.id,
        })
        .populate("patientId", "name email")
        .sort({ createdAt: -1 });

        res.status(200).json({
            requests,
        });
        
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const createAnonymousSOSEmergency = async (req, res) => {
    try {
        const { pickupLocation } = req.body;

        if (!pickupLocation || !pickupLocation.coordinates || pickupLocation.coordinates.length < 2) {
            return res.status(400).json({
                message: "Valid pickup coordinates are required for SOS dispatch."
            });
        }

        // Check if the system-wide Anonymous SOS user exists
        let anonymousUser = await User.findOne({ email: "sos@system.local" });
        if (!anonymousUser) {
            // Create a system-wide SOS placeholder user to satisfy schema references
            anonymousUser = await User.create({
                name: "Anonymous SOS Caller",
                email: "sos@system.local",
                username: "anonymous_sos",
                password: "system_generated_sos_password_123",
                role: "patient"
            });
        }

        const request = await emergencyRequest.create({
            patientId: anonymousUser._id,
            emergencyType: "Severe_Bleeding", // Default critical type
            pickupLocation,
            patientNotes: "EMERGENCY SOS: Triggered anonymously from login screen."
        });

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role");

        const io = getIo();
        io.emit("emergencyRequest", populatedRequest);

        res.status(201).json({
            message: "SOS Emergency dispatch created successfully",
            request: populatedRequest,
        });

    } catch (error) {
        console.error("SOS Emergency request error:", error);
        res.status(500).json({
            message: error.message,
        });
    }
};

const cancelAnonymousSOSEmergency = async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await emergencyRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({
                message: "Emergency request not found"
            });
        }

        request.status = "cancelled";
        await request.save();

        const populatedRequest = await emergencyRequest.findById(request._id)
            .populate("patientId", "name email role")
            .populate("driverId", "name email");

        const io = getIo();
        io.emit("emergencyStatusUpdated", populatedRequest);

        res.status(200).json({
            message: "SOS Emergency cancelled successfully",
            request: populatedRequest
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
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
    cancelAnonymousSOSEmergency
};