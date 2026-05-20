
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



const port = process.env.PORT;

const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const emergencyRoutes = require("./routes/emergencyRoutes.js");


//Middleware
app.use(cors());
app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/emergency", emergencyRoutes);



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

initializeSocket(io);

io.on("connection", (socket) => {
    
    console.log("connected", socket.id);

    socket.on("driverLocationUpdate", (data)=> {
        console.log("Live Driver Location", data);
        io.emit("driverLocationUpdated", data);
    });
});


server.listen(port, ()=>{
    console.log(`Backend is runningon port ${port}`);
});

