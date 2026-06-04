const mongoose = require("mongoose");

const hazardSchema = new mongoose.Schema({
  route: { type: String, required: true },
  type: { type: String, required: true },
  severity: { type: String, enum: ["low", "medium", "critical"], required: true },
  description: { type: String, required: true },
  upvotes: { type: Number, default: 0 },
  upvotedBy: [{ type: String }], // Array of user IDs to track upvotes
  author: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Hazard", hazardSchema);
