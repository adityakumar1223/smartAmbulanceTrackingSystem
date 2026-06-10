const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point'
    },
    coordinates: {
        type: [Number],
        required: true
    }
});

const emergencyRequestSchema = new mongoose.Schema({

    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    emergencyType: {
        type: String,
        required: true,
    },

    pickupLocation: {
        type: pointSchema,
        required:true
    },

    dropoffLocation: {
        type: pointSchema,
    },

    status: {
        type: String,

        enum: [
            "pending",
            "accepted",
            "on_the_way",
            "arrived",
            "boarded",
            "in_transit",
            "completed",
            "cancelled"
        ],

        default: "pending",
    },

    patientNotes: {
        type: String,
        default: '',
    },

    notifiedDrivers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    
}, {
    timestamps: true,
});

emergencyRequestSchema.index({pickupLocation:'2dsphere'});
emergencyRequestSchema.index({status: 1, createdAt:-1});

module.exports = mongoose.model("emergencyRequest", emergencyRequestSchema);