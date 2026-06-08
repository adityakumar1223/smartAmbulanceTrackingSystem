
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database.js");

//adding for socket io
const http = require('http');
const { Server } = require('socket.io');
const  { initializeSocket } = require("./sockets/socket.js");


require('dotenv').config();

connectDB();

const app = express();



const port = process.env.PORT || 5000;

const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const emergencyRoutes = require("./routes/emergencyRoutes.js");
const communityRoutes = require("./routes/communityRoutes.js");


//Middleware
app.use(cors());
app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/community", communityRoutes);

// Global error-handling middleware (BUG-07)
app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err.stack || err);
    res.status(err.status || 500).json({
        message: err.message || "Internal Server Error",
    });
});

app.get("/", (req, res)=>{
    res.send("Backend is running");
})


//socket line
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

app.set("io", io);

initializeSocket(io);

io.on("connection", (socket) => {
    
    console.log("connected", socket.id);

    socket.on("driverLocationUpdate", (data)=> {
        console.log("Live Driver Location", data);
        io.emit("driverLocationUpdated", data);
    });

    socket.on("patientLocationUpdate", (data)=> {
        console.log("Live Patient Location", data);
        io.emit("patientLocationUpdated", data);
    });
});


// Seed community data once on startup (BUG-18: moved from per-request to startup)
const Post = require("./models/post.js");
const Hazard = require("./models/hazard.js");
const seedCommunity = async () => {
    try {
        const postCount = await Post.countDocuments();
        if (postCount === 0) console.log("Community posts collection empty — will seed on first access.");
        const hazardCount = await Hazard.countDocuments();
        if (hazardCount === 0) console.log("Road hazards collection empty — will seed on first access.");
    } catch (err) {
        // DB not ready yet, seeding will happen on first request
    }
};

server.listen(port, ()=>{
    console.log(`Backend is running on port ${port}`);
    seedCommunity();
});

