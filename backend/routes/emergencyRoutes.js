const express = require("express");
const router = express.Router();

const {protect, authorizeRoles, } = require("../middleware/authMiddleware.js");

const {
    createEmergencyRequest, 
    getAllEmergencyRequest, 
    acceptEmergencyRequest, 
    getAllPendingRequest, 
    updateEmergencyStatus,
    getDriverRequest
                            } = require("../controllers/emergencyController.js");

//patient creates request

router.post("/request", protect, authorizeRoles("patient"), createEmergencyRequest);

//hospital and admin can get all the emergency requests

router.get("/all", protect, authorizeRoles("admin", "hospital"), getAllEmergencyRequest);

//driver accepts the emergency request

router.put("/accept/:id", protect, authorizeRoles("driver"), acceptEmergencyRequest);

// drivers to see pending requests

router.get("/pending", protect, authorizeRoles("driver"), getAllPendingRequest);

//updating status of the emergency request

router.put("/updateStatus/:id", protect, authorizeRoles("driver"), updateEmergencyStatus);

//driver can see their requests

router.get("/my-requests", protect, authorizeRoles("driver"), getDriverRequest);

module.exports = router;