const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    emergencyRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "emergencyRequest",
        required: true,
    },
    sender: {
        type: String,
        enum: ["patient", "driver", "ai"],
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
}, {
    timestamps: true
});

// Compound index for fast retrieval of chat logs by request id and time order
chatSchema.index({ emergencyRequestId: 1, createdAt: 1 });

module.exports = mongoose.model("Chat", chatSchema);
