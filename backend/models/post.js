const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  author: {
    name: { type: String, required: true },
    role: { type: String, required: true },
    avatar: { type: String, default: "👤" }
  },
  content: { type: String, required: true },
  image: { type: String, default: null }, // Store base64 image data
  likes: { type: Number, default: 0 },
  likedBy: [{ type: String }], // Array of user IDs (emails/IDs) to track who liked
  comments: [{
    id: { type: String, required: true },
    author: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Post", postSchema);
