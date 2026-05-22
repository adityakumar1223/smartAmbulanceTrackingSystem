const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

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

    isAvailable: {
        type: Boolean,
        default: false
    },

    currentLocation:{
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates:{
            type: [Number],
            default: [0,0],
        }
    },

    activeEmergencyId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmergencyRequest',
        default:null,
    },

    dob:{
        type: Date,
        required: false,
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
}, {timestamps: true});

userSchema.index({currentLocation: '2dsphere'});

module.exports = mongoose.model("User", userSchema);