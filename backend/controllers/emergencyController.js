const emergencyRequest = require("../models/emergencyRequest.js");

const createEmergencyRequest = async (req, res) => {
    try {

        const {
            emergencyType,
            pickupLocation
        } = req.body;

        const request = await emergencyRequest.create({
            patientId: req.user.id,
            emergencyType,
            pickupLocation
        });

        res.status(201).json({
            message: "Emergency request created",
            request,
        })
                
    } catch (error) {
        res.status(500).json({
            message: error.message,
        })
    }
};

module.exports = {createEmergencyRequest };