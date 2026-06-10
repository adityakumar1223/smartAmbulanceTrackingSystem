const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/user.js");
const emergencyRequest = require("./models/emergencyRequest.js");

async function check() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        const { activeUsers } = require("./sockets/socket.js");
        console.log(`\n=== ACTIVE SOCKET USERS ===`);
        console.log(Array.from(activeUsers.keys()));

        const drivers = await User.find({ role: "driver" });
        console.log(`\n=== FOUND ${drivers.length} DRIVERS IN DB ===`);
        drivers.forEach(d => {
            console.log(`- Name: ${d.name}`);
            console.log(`  Email: ${d.email}`);
            console.log(`  ID: ${d._id}`);
            console.log(`  Location:`, JSON.stringify(d.location));
            console.log(`  CurrentLocation:`, JSON.stringify(d.currentLocation));
        });

        const activeRequests = await emergencyRequest.find({
            status: { $in: ["pending", "accepted", "on_the_way", "arrived", "boarded", "in_transit"] }
        });
        console.log(`\n=== FOUND ${activeRequests.length} ACTIVE REQUESTS ===`);
        activeRequests.forEach(r => {
            console.log(`- Request ID: ${r._id}`);
            console.log(`  Status: ${r.status}`);
            console.log(`  Driver ID: ${r.driverId}`);
            console.log(`  Notified Drivers:`, r.notifiedDrivers);
        });

        mongoose.connection.close();
    } catch (err) {
        console.error("Error:", err);
    }
}

check();
