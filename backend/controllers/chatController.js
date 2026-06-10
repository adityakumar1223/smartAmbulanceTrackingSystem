const Chat = require("../models/Chat.js");
const emergencyRequest = require("../models/emergencyRequest.js");
const { getIo, getUserSocketIds } = require("../sockets/socket.js");
const { Groq } = require("groq-sdk");

// Lazy-loaded groq instance
let groq;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * Fetch chat messages for an emergency request
 */
const getChatHistory = async (req, res) => {
    try {
        const { emergencyRequestId } = req.params;
        const chats = await Chat.find({ emergencyRequestId }).sort({ createdAt: 1 });
        res.status(200).json({ success: true, chats });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch chat history." });
    }
};

/**
 * Send a chat message and trigger AI response asynchronously
 */
const sendMessage = async (req, res) => {
    try {
        const { emergencyRequestId, sender, message } = req.body;

        if (!emergencyRequestId || !sender || !message) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Validate sender role
        const validSenders = ["patient", "driver", "ai"];
        if (!validSenders.includes(sender)) {
            return res.status(400).json({ success: false, message: "Invalid sender value." });
        }

        // 1. Save user's message
        const userMsg = await Chat.create({ emergencyRequestId, sender, message });

        // 2. Fetch the emergency request details to find participants
        const reqDoc = await emergencyRequest.findById(emergencyRequestId);
        if (!reqDoc) {
            return res.status(404).json({ success: false, message: "Emergency request not found" });
        }

        // 3. Emit user message via Socket.io to participants
        const io = getIo();
        const socketIds = getUserSocketIds([reqDoc.patientId, reqDoc.driverId]);
        socketIds.forEach(socketId => {
            io.to(socketId).emit("new_message", userMsg);
        });

        // 4. Return success status immediately
        res.status(201).json({ success: true, message: userMsg });

        // 5. Trigger asynchronous AI response in the background
        generateAiFirstAidAdvice(emergencyRequestId, message, reqDoc, socketIds).catch(err => {
            console.error("AI First Aid Assistant failed to generate advice:", err);
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to send message." });
    }
};

/**
 * FIX #23: Generate AI medical response with full conversation history for context.
 * Previously only the last user message was sent to the model, making it stateless.
 * Now the last 10 messages are fetched and included so the AI can maintain context.
 */
const generateAiFirstAidAdvice = async (emergencyRequestId, userMessage, reqDoc, socketIds) => {
    if (!process.env.GROQ_API_KEY) {
        console.warn("GROQ_API_KEY is not defined. Skipping AI First Aid response.");
        return;
    }

    if (!groq) {
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    const description = `Emergency Type: ${reqDoc.emergencyType.replace(/_/g, " ")}, Patient Notes: ${reqDoc.patientNotes || "No notes provided"}`;
    const systemPrompt = `You are an emergency response and first aid assistant. Provide concise, actionable first-aid advice for the emergency situation: ${description}. Keep advice brief, clear, and strictly safety-focused. Format your response with plain text only — no markdown asterisks, bullets, or special characters. Use numbered steps for clarity.`;

    // FIX #23: Fetch the last 10 messages to maintain conversation context
    const recentChats = await Chat.find({ emergencyRequestId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    // Reverse to chronological order for the model
    const conversationHistory = recentChats.reverse().map(msg => ({
        role: msg.sender === "ai" ? "assistant" : "user",
        content: msg.message
    }));

    const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: userMessage }
        ],
        max_completion_tokens: 512
    });

    const aiText = response.choices[0].message.content;

    if (aiText && aiText.trim()) {
        const aiMsg = await Chat.create({ emergencyRequestId, sender: "ai", message: aiText });

        const io = getIo();
        socketIds.forEach(socketId => {
            io.to(socketId).emit("new_message", aiMsg);
        });
    }
};

/**
 * Automatically initiate first aid advice when emergency request is loaded
 */
const initiateChat = async (req, res) => {
    try {
        const { emergencyRequestId } = req.body;

        if (!emergencyRequestId) {
            return res.status(400).json({ success: false, message: "Missing emergencyRequestId" });
        }

        // 1. Check if chat history already has messages
        const existingCount = await Chat.countDocuments({ emergencyRequestId });
        if (existingCount > 0) {
            const chats = await Chat.find({ emergencyRequestId }).sort({ createdAt: 1 });
            return res.status(200).json({ success: true, chats, initiated: false });
        }

        // 2. Fetch the emergency request details
        const reqDoc = await emergencyRequest.findById(emergencyRequestId);
        if (!reqDoc) {
            return res.status(404).json({ success: false, message: "Emergency request not found" });
        }

        // 3. Setup Groq system prompt
        const description = `Emergency Type: ${reqDoc.emergencyType.replace(/_/g, " ")}, Patient Notes: ${reqDoc.patientNotes || "No notes provided"}`;
        const systemPrompt = `You are an emergency response and first aid assistant. Provide concise, actionable first-aid advice for the emergency situation: ${description}. Keep advice brief, clear, and strictly safety-focused. Format your response with plain text only — no markdown asterisks, bullets, or special characters. Use numbered steps for clarity.`;

        let aiText = "Hold on, generating first aid guidelines for your emergency situation...";
        if (process.env.GROQ_API_KEY) {
            if (!groq) {
                groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            }

            const response = await groq.chat.completions.create({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Provide initial first-aid advice for this situation." }
                ],
                max_completion_tokens: 512
            });
            aiText = response.choices[0].message.content;
        }

        // 4. Save initial AI first aid advice
        const aiMsg = await Chat.create({ emergencyRequestId, sender: "ai", message: aiText });

        // 5. Emit new_message event via Socket.io
        const io = getIo();
        const socketIds = getUserSocketIds([reqDoc.patientId, reqDoc.driverId]);
        socketIds.forEach(socketId => {
            io.to(socketId).emit("new_message", aiMsg);
        });

        res.status(201).json({ success: true, chats: [aiMsg], initiated: true });

    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to initiate chat." });
    }
};

module.exports = { getChatHistory, sendMessage, initiateChat };
