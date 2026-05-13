const express = require('express');

const router = express.Router();

const {protect, authorizeRoles} = require("../middleware/authMiddleware.js");

router.get(
    "/dashboard",
    protect, 
    authorizeRoles('admin'),
    (req, res) =>{


        res.json("Welcome to admin panel");
    } 
)

module.exports = router;