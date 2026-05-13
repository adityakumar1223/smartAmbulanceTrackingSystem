const mongoose = require('mongoose');

const emergencyRequestSchema = new mongoose.Schema({

    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,

    },

    emergencyType: {
        type: String,
        required: true,
    },

    pickupLocation: {
        address: String,
        latitude: Number,
        longitude: Number,
    },

    status: {
        type: String,

        enum: [
            "pending",
            "accepted",
            "on_the_way",
            "completed",
        ],

        default: "pending",
    },

    assignedDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    
}, {
    timestamps: true,
});

module.exports = mongoose.model("emergencyRequest", emergencyRequestSchema);