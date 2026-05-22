const emergencyRequest = require("../models/emergencyRequest.js");
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

module.exports = {
    createEmergencyRequest, 
    getAllEmergencyRequest, 
    acceptEmergencyRequest, 
    getAllPendingRequest, 
    updateEmergencyStatus,
    getDriverRequest
};