const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    
    avatar: {
        type:{
            url: String,
            localPath: String,
        },
        default:{
            url: `https://placehold.co/200x200`,
            localPath: ``,
        }
    },

    name:{
        type: String,
        required: true,
    },

    username:{
        type: String,
        // required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },

    email:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },

    password:{
        type: String,
        required: true,
        trim: true,
    },

    role:{
        type: String,
        enum: ["patient", "admin", "driver", "hospital"],
        required:true,
        default: "patient",
    },

    dob:{
        type: Date,
        required: [true, "Date of birth is required"],
        trim: true,

    },

    refreshToken: {
        type: String,
    },

    forgotPasswordToken: {
            type: String,
    },

        forgotPasswordExpiry: {
            type: Date,
    },

        emailVerificationToken:{
            type: String,
    },

        emailVerificationExpiry: {
            type: Date,
    },
});

module.exports = mongoose.model("User", userSchema);