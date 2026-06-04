const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected successfully...");
    } catch (error) {
        console.error("\n==================================================================");
        console.error("❌ MONGODB CONNECTION ERROR");
        console.error("==================================================================");
        console.error("Could not connect to the MongoDB Atlas cluster. This is typically because");
        console.error("your local public IP address is not whitelisted in your Atlas security settings.");
        console.error("\n👉 TROUBLESHOOTING STEPS:");
        console.error("1. Log in to your MongoDB Atlas dashboard (https://cloud.mongodb.com).");
        console.error("2. Navigate to 'Network Access' under the 'Security' section in the sidebar.");
        console.error("3. Click 'Add IP Address'.");
        console.error("4. Add your current public IP address (or click 'ALLOW ACCESS FROM ANYWHERE' for easy local testing).");
        console.error("5. Save/confirm and wait a moment for the Atlas firewall rule to update.");
        console.error("==================================================================\n");
        console.error("Error details:", error.message || error);
        process.exit(1);        
    }
};

module.exports = connectDB;