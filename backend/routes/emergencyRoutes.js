const express = require("express");
const router = express.Router();
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB max
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Only JPEG, PNG, WEBP, and GIF are accepted.`));
        }
    }
});

// FIX #5: Strict rate limit for the unauthenticated SOS endpoint
const sosLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many SOS requests. Please call emergency services directly." }
});

const { protect, authorizeRoles } = require("../middleware/authMiddleware.js");

const {
    createEmergencyRequest,
    getAllEmergencyRequest,
    acceptEmergencyRequest,
    getAllPendingRequest,
    updateEmergencyStatus,
    getDriverRequest,
    createAnonymousSOSEmergency,
    cancelAnonymousSOSEmergency,
    updateStatusToBoarded,
    getActiveEmergencyRequest,
    cancelEmergencyRequest,
    aiProcessEmergencyScene,
    connectToNextDriver
} = require("../controllers/emergencyController.js");

// ── Patient routes ─────────────────────────────────────────────────────────
router.post("/request", protect, authorizeRoles("patient"), createEmergencyRequest);
router.post("/ai-process", protect, authorizeRoles("patient"), upload.single("image"), aiProcessEmergencyScene);
router.put("/cancel/:id", protect, authorizeRoles("patient"), cancelEmergencyRequest);
router.put("/next-driver/:id", protect, authorizeRoles("patient"), connectToNextDriver);

// FIX #4: Debug routes /test-online and /test-match have been REMOVED.
// They exposed all online user IDs and internal driver-matching details to anyone.

// FIX #5: SOS routes are unauthenticated by design but now rate-limited
router.post("/sos", sosLimiter, createAnonymousSOSEmergency);
router.put("/sos/cancel/:id", sosLimiter, cancelAnonymousSOSEmergency);

// ── Admin / Hospital routes ────────────────────────────────────────────────
router.get("/all", protect, authorizeRoles("admin", "hospital"), getAllEmergencyRequest);

// ── Driver routes ──────────────────────────────────────────────────────────
router.put("/accept/:id", protect, authorizeRoles("driver"), acceptEmergencyRequest);
router.get("/pending", protect, authorizeRoles("driver"), getAllPendingRequest);
router.put("/updateStatus/:id", protect, authorizeRoles("driver"), updateEmergencyStatus);
router.put("/boarded/:id", protect, authorizeRoles("driver"), updateStatusToBoarded);
router.get("/my-requests", protect, authorizeRoles("driver"), getDriverRequest);

// ── Shared (patient + driver) ──────────────────────────────────────────────
router.get("/active", protect, getActiveEmergencyRequest);

module.exports = router;