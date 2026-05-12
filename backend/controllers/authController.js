const User = require("../models/user.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async(req , res) =>{

    try {
        const { name, username, email, password, role, dob  } = req.body;
        const existingUser = await User.findOne({email});

        if(existingUser){
            return res.status(400).json({
                message: "User already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 8);

        const user = await User.create({
            name, 
            username, 
            email, 
            password: hashedPassword, 
            role, 
            dob,
        });

        res.status(201).json({
            message: "User registered sucessfully",
        })

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

module.exports = {registerUser};