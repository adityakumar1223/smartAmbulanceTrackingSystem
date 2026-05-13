const jwt = require("jsonwebtoken");

const protect = async (req, res, next) =>{

    let token;

    try {
        //check authorization header
        if(
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ){
            token = req.headers.authorization.split(" ")[1]

            //verify token
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            //store user data in request
            req.user = decoded;

            next();

        }else{

            return res.status(401).json({
                message: "not authorized, no token",
            })
            
        }
        
        
    } catch (error) {
        return res.status(401).json({
            message: "Token failed",
        })
    }
    
};

module.exports = {protect};