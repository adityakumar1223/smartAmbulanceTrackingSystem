const User = require("../models/user.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// FIX #9: Input validation — prevent NoSQL injection, role escalation, and empty fields
const registerUser = async (req, res) => {
    try {
        const { name, username, email, password, role, dob } = req.body;

        // ── Validate name ────────────────────────────────────────────────────────
        if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
            return res.status(400).json({ message: "Name must be between 2 and 100 characters." });
        }

        // ── Validate email ───────────────────────────────────────────────────────
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "A valid email address is required." });
        }

        // ── Validate password ────────────────────────────────────────────────────
        if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
            return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
        }

        // FIX #9: Whitelist allowed roles — clients must NEVER be trusted to self-assign admin/hospital
        const allowedRoles = ["patient", "driver"];
        const assignedRole = allowedRoles.includes(role) ? role : "patient";

        // ── Validate username (optional) ─────────────────────────────────────────
        if (username) {
            if (!/^[a-z0-9_]{3,30}$/.test(username.toLowerCase())) {
                return res.status(400).json({ message: "Username must be 3–30 lowercase alphanumeric characters or underscores." });
            }
            const existingUsername = await User.findOne({ username: username.toLowerCase() });
            if (existingUsername) {
                return res.status(400).json({ message: "Username is already taken." });
            }
        }

        // ── Check for duplicate email ────────────────────────────────────────────
        const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingEmail) {
            return res.status(400).json({ message: "Email is already registered." });
        }

        // FIX #9: Use bcrypt cost factor 12 (was 8 — too low for modern hardware)
        const hashedPassword = await bcrypt.hash(password, 12);

        await User.create({
            name: name.trim(),
            username: username ? username.toLowerCase().trim() : undefined,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: assignedRole,
            dob,
        });

        res.status(201).json({ message: "User registered successfully." });

    } catch (error) {
        console.error("Register error:", error);
        // FIX #30: Never expose raw error details to clients
        res.status(500).json({ message: "Registration failed. Please try again." });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // FIX #18: Use a single, unified error message to prevent username enumeration.
        // A timing-safe dummy bcrypt compare is run even when the user is not found
        // so response time is consistent regardless of whether the account exists.
        const INVALID_CREDS_MSG = "Invalid email or password.";

        if (!user) {
            // Dummy hash comparison to normalize response time
            await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection0000000000000000000000000");
            return res.status(401).json({ message: INVALID_CREDS_MSG });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: INVALID_CREDS_MSG });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Login failed. Please try again." });
    }
};

module.exports = { registerUser, loginUser };