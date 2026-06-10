const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware.js");
const { getChatHistory, sendMessage, initiateChat } = require("../controllers/chatController.js");

router.get("/:emergencyRequestId", protect, getChatHistory);
router.post("/send", protect, sendMessage);
router.post("/initiate", protect, initiateChat);

module.exports = router;
