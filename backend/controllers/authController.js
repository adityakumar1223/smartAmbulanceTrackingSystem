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

const loginUser = async(req, res) => {

    try {
        const {email, password} = req.body;
        
        const user = await User.findOne({email});

        if(!user){
            return res.status(400).json({
                message: "user doesn't exist",
            });
        }

        //compare password
        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch){
            return res.statis(400).json({
                message: "password incorrect",
            });
        }

        //Generating json web tokens
        const token = jwt.sign(
            {
                id: user._id,
                role: user.role,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        res.status(200).json({
            message: "login sucessfully",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
    
}

module.exports = {registerUser, loginUser};