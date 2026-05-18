const emergencyRequest = require("../models/emergencyRequest.js");

const createEmergencyRequest = async (req, res) => {
    try {

        const {
            emergencyType,
            pickupLocation
        } = req.body;

        const request = await emergencyRequest.create({
            patientId: req.user.id,
            emergencyType,
            pickupLocation
        });

        res.status(201).json({
            message: "Emergency request created",
            request,
        })
                
    } catch (error) {
        res.status(500).json({
            message: error.message,
        })
    }
};

const getAllEmergencyRequest = async (req, res) =>{


    try {

        const requests = await emergencyRequest.find()
            .populate("patientId","name email role")
            .populate("assignedDriver", "name email");

            res.status(200).json({
                requests,
            })
        
    } catch (error) {
        res.status(500).json({
            message: error.message,
        })
    }
    
    
}

const getAllPendingRequest = async(req, res) => {

    try {
        const requests = await emergencyRequest.find({
            status: "pending",
        });

        res.status(200).json({
            requests
        });

    } catch (error) {

        res.send(500).json({
            message: error.message,
        });
        
    }
    
};

const acceptEmergencyRequest = async (req, res) => {

    try {

        const requestId = req.params.id;
        const request = await emergencyRequest.findById(requestId);

        if(!requestId){
            res.send(404).json({
                message: "Emergency request not found",
            });
        }

        //preventing accepting already accepted requests
        if(request.status !== "pending"){
            res.status(200).json({
                message: "Request already accepted",
            });
        };

        request.status = "accepted";

        request.assignedDriver = req.user.id;

        await request.save();

        res.status(200).json({
            message: "Emergency request accepted",
            request,
        })
        
    } catch (error) {
        console.log("bounced");
        res.status(500).json({
            
            message: error.message,
        });
    }

}

const updateEmergencyStatus = async (req, res) =>{

    const validStatuses = [
        "pending",
        "accepted",
        "on_the_way",
        "arrived",
        "completed"
    ];

    try {
        
        const requestId = req.params.id;

        const {status} = req.body;

        const request = await emergencyRequest.findById(requestId);

        if(!requestId) {
            return res.status(400).json({
                message: "Emergency request not found"
            })
        }

        if(!validStatuses.includes(status)){
            return res.status(200).json({
                message: "Invalid status",
            });
        };

        request.status = status;

        await request.save();

        res.status(200).json({
            message: "Emergency status updated"
        });



        
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

const getDriverRequest = async (req, res) => {

    try {

        const requests = await emergencyRequest.find({
            assignedDriver: req.user.id,
        })

        .populate("patientId", "name email")
        .sort({createdAt: -1});

        res.status(200).json({
            requests,
        });
        
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
    
};



module.exports = {
    createEmergencyRequest, 
    getAllEmergencyRequest, 
    acceptEmergencyRequest, 
    getAllPendingRequest, 
    updateEmergencyStatus,
    getDriverRequest
};