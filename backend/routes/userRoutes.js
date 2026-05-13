const express = require('express');
const router = express.Router();
const {protect} = require("../middleware/authMiddleware.js");

router.get("/profile", protect, (req, res)=>{

    res.json({
        message: "Protected route acesses",
        user: req.user,
    });
    
});

module.exports = router;