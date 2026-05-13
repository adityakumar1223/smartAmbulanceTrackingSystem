const express = require("express");
const router = express.Router();

const {protect, authorizeRoles, } = require("../middleware/authMiddleware.js");

const {createEmergencyRequest} = require("../controllers/emergencyController.js");

//patient creates request

router.post("/request", protect, authorizeRoles("patient"), createEmergencyRequest);

module.exports = router;