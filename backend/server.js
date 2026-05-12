const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database.js");
const authRoutes = require("./routes/authRoutes.js");

connectDB();
const app = express();


require('dotenv').config();




app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/", (req, res)=>{
    res.send("Backend is running");
})

// app.get("*", (req, res)=>{
//     res.status(404).send("PAGE NOT FOUND");
// });

const port = process.env.PORT;

app.listen(port, (req, res)=>{
    console.log(`Backend is runningon port ${port}`);
});

