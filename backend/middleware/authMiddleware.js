const jwt = require("jsonwebtoken");

const protect = async (req, res, next) => {
    let token;

    try {
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = decoded;
            next();

        } else {
            return res.status(401).json({
                message: "Not authorized. Please log in.",
            });
        }

    } catch (error) {
        // FIX #17: Use a generic message — do not hint whether the token was present/expired/malformed
        return res.status(401).json({
            message: "Not authorized. Please log in.",
        });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            // FIX #33: Removed console.log(req.user.role) — no role leakage to logs in production
            return res.status(403).json({
                message: "Access denied. You do not have permission for this action.",
            });
        }
        next();
    };
};

module.exports = { protect, authorizeRoles };