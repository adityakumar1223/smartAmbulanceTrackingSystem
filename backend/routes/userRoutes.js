const express = require('express');
const router = express.Router();
const {protect} = require("../middleware/authMiddleware.js");
const User = require("../models/user.js");
const bcrypt = require("bcryptjs");

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

router.get("/profile", protect, (req, res)=>{

    res.json({
        message: "Protected route acesses",
        user: req.user,
    });
    
});

router.get("/hospitals", protect, async (req, res) => {
  try {
    const count = await User.countDocuments({ role: "hospital" });
    if (count === 0) {
      const hashedPassword = await bcrypt.hash("password123", 8);
      const hospitalsToSeed = MOCK_HOSPITALS.map(h => ({
        ...h,
        username: h.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        password: hashedPassword
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

module.exports = router;