
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database.js");

require('dotenv').config();

connectDB();

const app = express();

const port = process.env.PORT;

const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes.js");


//Middleware
app.use(cors());
app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

app.get("/", (req, res)=>{
    res.send("Backend is running");
})



app.listen(port, (req, res)=>{
    console.log(`Backend is runningon port ${port}`);
});

