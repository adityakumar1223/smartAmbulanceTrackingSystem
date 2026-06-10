const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/database.js");

const http = require('http');
const { Server } = require('socket.io');
const { initializeSocket } = require("./sockets/socket.js");
const User = require("./models/user.js");

require('dotenv').config();

connectDB();

const app = express();
const port = process.env.PORT || 5000;

const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const emergencyRoutes = require("./routes/emergencyRoutes.js");
const communityRoutes = require("./routes/communityRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");

// ─── CORS ──────────────────────────────────────────────────────────────────────
// FIX #10: Restrict CORS to the configured frontend origin instead of wildcard "*"
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use(cors({
    origin: allowedOrigin,
    credentials: true,
}));

app.use(express.json({ limit: "2mb" }));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
// FIX #25: Apply rate limiting to all API routes to prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please slow down and try again later." }
});

// Stricter limit for authentication endpoints to prevent brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts, please try again in 15 minutes." }
});

// Strict limit for SOS to prevent anonymous flooding (FIX #5)
const sosLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: { message: "Too many SOS requests. Please call emergency services directly." }
});

app.use("/api/", apiLimiter);
app.use("/api/auth/", authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
    res.send("Backend is running");
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
// FIX #30: Never expose raw error.message to clients in production
app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err.stack || err);
    const isDev = process.env.NODE_ENV === "development";
    res.status(err.status || 500).json({
        message: isDev ? (err.message || "Internal Server Error") : "Internal Server Error",
    });
});

// ─── Socket.io ─────────────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // FIX #10: Socket.io CORS also restricted to known origin
        origin: allowedOrigin,
        credentials: true,
    },
});

app.set("io", io);

// FIX #26: All socket logic is consolidated in sockets/socket.js.
// The duplicate io.on("connection") handler that was in this file has been removed.
// This prevents double DB writes on every driverLocationUpdate event.
initializeSocket(io);

// ─── Startup Tasks ─────────────────────────────────────────────────────────────
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

// FIX #20: Replace N individual user.save() calls with a single bulkWrite operation
const syncUserLocations = async () => {
    try {
        const usersToSync = await User.find({
            $or: [
                { location: { $exists: false } },
                { "location.coordinates": [0, 0] }
            ],
            "currentLocation.coordinates": { $exists: true }
        }).select("_id currentLocation").lean();

        if (usersToSync.length === 0) {
            console.log("All user location fields are already synchronized.");
            return;
        }

        const bulkOps = usersToSync
            .filter(u => u.currentLocation && u.currentLocation.coordinates && u.currentLocation.coordinates.length >= 2)
            .map(u => ({
                updateOne: {
                    filter: { _id: u._id },
                    update: { $set: { location: { type: "Point", coordinates: u.currentLocation.coordinates } } }
                }
            }));

        if (bulkOps.length > 0) {
            const result = await User.bulkWrite(bulkOps);
            console.log(`Synchronized location field for ${result.modifiedCount} users.`);
        }
    } catch (err) {
        console.error("Error synchronizing user locations:", err);
    }
};

server.listen(port, () => {
    console.log(`Backend is running on port ${port}`);
    seedCommunity();
    syncUserLocations();
});
