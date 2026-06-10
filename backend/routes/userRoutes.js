const express = require('express');
const router = express.Router();
const {protect} = require("../middleware/authMiddleware.js");
const User = require("../models/user.js");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { analyzeDocument } = require("../services/grokService.js");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Only PDF, JPEG, PNG, and WEBP are accepted.`));
        }
    }
});

const MOCK_HOSPITALS = [
  {
    name: "Patna Medical College Hospital (PMCH)",
    email: "pmch@hospital.com",
    role: "hospital",
    currentLocation: {
      type: "Point",
      coordinates: [85.1501, 25.6206]
    }
  },
  {
    name: "All India Institute of Medical Sciences (AIIMS) Patna",
    email: "aiims@hospital.com",
    role: "hospital",
    currentLocation: {
      type: "Point",
      coordinates: [85.0689, 25.5606]
    }
  },
  {
    name: "Indira Gandhi Institute of Medical Sciences (IGIMS)",
    email: "igims@hospital.com",
    role: "hospital",
    currentLocation: {
      type: "Point",
      coordinates: [85.0901, 25.6105]
    }
  },
  {
    name: "Paras HMRI Hospital",
    email: "paras@hospital.com",
    role: "hospital",
    currentLocation: {
      type: "Point",
      coordinates: [85.0975, 25.5991]
    }
  },
  {
    name: "Ruban Memorial Hospital",
    email: "ruban@hospital.com",
    role: "hospital",
    currentLocation: {
      type: "Point",
      coordinates: [85.1054, 25.6174]
    }
  }
];

router.get("/profile", protect, async (req, res)=>{
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({
            message: "Protected route accessed",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isManualOverride: user.isManualOverride,
                isManualLocation: user.isManualLocation,
                location: user.location,
                currentLocation: user.currentLocation,
                bloodGroup: user.bloodGroup,
                insuranceId: user.insuranceId,
                allergies: user.allergies,
                conditions: user.conditions,
                emergencyContactName: user.emergencyContactName,
                emergencyContactPhone: user.emergencyContactPhone,
                medicalRecords: user.medicalRecords
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/hospitals", protect, async (req, res) => {
  try {
    const count = await User.countDocuments({ role: "hospital" });
    if (count === 0) {
      const hashedPassword = await bcrypt.hash("password123", 8);
      const hospitalsToSeed = MOCK_HOSPITALS.map(h => ({
        ...h,
        username: h.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        password: hashedPassword,
        location: h.currentLocation
      }));
      await User.insertMany(hospitalsToSeed);
      console.log("Mock hospitals successfully seeded in User database.");
    }
    const hospitals = await User.find({ role: "hospital" }).select("name email role currentLocation");
    res.status(200).json({ hospitals });
  } catch (error) {
    res.status(500).json({ message: "Failed to load nearby hospitals", error: error.message });
  }
});

router.put("/profile", protect, async (req, res) => {
    try {
        const { bloodGroup, insuranceId, allergies, conditions, emergencyContactName, emergencyContactPhone } = req.body;
        const user = await User.findByIdAndUpdate(req.user.id, {
            bloodGroup: bloodGroup || "",
            insuranceId: insuranceId || "",
            allergies: allergies || "",
            conditions: conditions || "",
            emergencyContactName: emergencyContactName || "",
            emergencyContactPhone: emergencyContactPhone || ""
        }, { new: true });
        
        res.json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isManualOverride: user.isManualOverride,
                isManualLocation: user.isManualLocation,
                location: user.location,
                currentLocation: user.currentLocation,
                bloodGroup: user.bloodGroup,
                insuranceId: user.insuranceId,
                allergies: user.allergies,
                conditions: user.conditions,
                emergencyContactName: user.emergencyContactName,
                emergencyContactPhone: user.emergencyContactPhone,
                medicalRecords: user.medicalRecords
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/medical-records", protect, upload.single("file"), async (req, res) => {
    try {
        const { title, description, autoAnalyze } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let finalTitle = title;
        let finalDescription = description;

        // If explicitly requested, or if fields are empty, analyze the document using Grok AI
        if (autoAnalyze === "true" || !finalTitle || !finalDescription) {
            try {
                const aiResult = await analyzeDocument(req.file.buffer, req.file.mimetype);
                if (!finalTitle) finalTitle = aiResult.title;
                if (!finalDescription) finalDescription = aiResult.description;
            } catch (aiErr) {
                console.error("Grok automatic document analysis failed:", aiErr);
            }
        }

        const record = {
            title: finalTitle || req.file.originalname,
            description: finalDescription || "Uploaded medical record.",
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileData: req.file.buffer.toString("base64"),
            uploadedAt: new Date()
        };

        user.medicalRecords.push(record);
        await user.save();

        res.status(201).json({
            message: "Medical record uploaded successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isManualOverride: user.isManualOverride,
                isManualLocation: user.isManualLocation,
                location: user.location,
                currentLocation: user.currentLocation,
                bloodGroup: user.bloodGroup,
                insuranceId: user.insuranceId,
                allergies: user.allergies,
                conditions: user.conditions,
                emergencyContactName: user.emergencyContactName,
                emergencyContactPhone: user.emergencyContactPhone,
                medicalRecords: user.medicalRecords
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete("/medical-records/:recordId", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.medicalRecords = user.medicalRecords.filter(r => r._id.toString() !== req.params.recordId);
        await user.save();

        res.json({
            message: "Medical record deleted successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isManualOverride: user.isManualOverride,
                isManualLocation: user.isManualLocation,
                location: user.location,
                currentLocation: user.currentLocation,
                bloodGroup: user.bloodGroup,
                insuranceId: user.insuranceId,
                allergies: user.allergies,
                conditions: user.conditions,
                emergencyContactName: user.emergencyContactName,
                emergencyContactPhone: user.emergencyContactPhone,
                medicalRecords: user.medicalRecords
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;