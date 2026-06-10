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
        sparse: true,
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

    isManualOverride: {
        type: Boolean,
        default: false
    },

    isManualLocation: {
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

    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
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
    bloodGroup: {
        type: String,
        default: ""
    },
    insuranceId: {
        type: String,
        default: ""
    },
    allergies: {
        type: String,
        default: ""
    },
    conditions: {
        type: String,
        default: ""
    },
    emergencyContactName: {
        type: String,
        default: ""
    },
    emergencyContactPhone: {
        type: String,
        default: ""
    },
    medicalRecords: [{
        title: { type: String, required: true },
        description: String,
        fileName: { type: String, required: true },
        fileType: { type: String, required: true },
        fileData: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
    }],
}, {timestamps: true});

userSchema.pre('save', async function() {
    if (this.currentLocation && this.currentLocation.coordinates && this.currentLocation.coordinates.length >= 2) {
        if (!this.location || !this.location.coordinates || (this.location.coordinates[0] === 0 && this.location.coordinates[1] === 0)) {
            this.location = {
                type: 'Point',
                coordinates: this.currentLocation.coordinates
            };
        }
    }
});

userSchema.index({currentLocation: '2dsphere'});
userSchema.index({location: '2dsphere'});

module.exports = mongoose.model("User", userSchema);