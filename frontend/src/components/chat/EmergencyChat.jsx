import { useState, useEffect, useRef } from "react";
import { FiMessageSquare, FiSend, FiMinus, FiActivity } from "react-icons/fi";
import api from "../../services/api.js";
import socket from "../../socket/socket.js";

const formatChatMessage = (text) => {
    if (!text) return "";
    
    // Split text by newlines and handle lines with bullet points
    const lines = text.split("\n");
    return lines.map((line, idx) => {
        let content = line;
        
        // Check if it is a bullet point (starts with * or -)
        const isBullet = line.trim().startsWith("*") || line.trim().startsWith("-");
        if (isBullet) {
            // Remove the bullet character and trim leading spaces
            content = line.replace(/^\s*[\*\-]\s*/, "");
        }
        
        // Handle simple bold formatting: **text**
        const parts = content.split(/\*\*([^*]+)\*\*/g);
        const renderedParts = parts.map((part, pIdx) => {
            if (pIdx % 2 === 1) {
                return <strong key={pIdx} className="font-extrabold text-white">{part}</strong>;
            }
            return part;
        });

        if (isBullet) {
            return (
                <div key={idx} className="flex items-start gap-1.5 my-1 ml-2 text-slate-100">
                    <span className="text-red-500 mt-1 flex-shrink-0 text-[10px]">•</span>
                    <span className="flex-1 leading-relaxed">{renderedParts}</span>
                </div>
            );
        }

        return (
            <p key={idx} className={line.trim() === "" ? "h-2" : "my-1 leading-relaxed text-slate-100"}>
                {renderedParts}
            </p>
        );
    });
};

function EmergencyChat({ emergencyRequestId, userRole }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load message logs or auto-initiate first aid on load/id update
    useEffect(() => {
        if (!emergencyRequestId) {
            setMessages([]);
            return;
        }

        setMessages([]); // Clear chat immediately for the new request!

        const fetchHistoryAndInitiate = async () => {
            try {
                const res = await api.post("/chat/initiate", { emergencyRequestId });
                if (res.data && res.data.chats) {
                    setMessages(res.data.chats);
                }
            } catch (err) {
                console.error("Failed to load or initiate chat history:", err);
            }
        };

        fetchHistoryAndInitiate();
    }, [emergencyRequestId]);

    // Socket listener for real-time messages
    useEffect(() => {
        if (!emergencyRequestId) return;

        const handleNewMessage = (msg) => {
            if (msg.emergencyRequestId === emergencyRequestId) {
                setMessages((prev) => {
                    // Prevent duplicate logs
                    if (prev.some((m) => m._id === msg._id)) return prev;
                    return [...prev, msg];
                });
            }
        };

        socket.on("new_message", handleNewMessage);

        return () => {
            socket.off("new_message", handleNewMessage);
        };
    }, [emergencyRequestId]);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !emergencyRequestId) return;

        const payload = {
            emergencyRequestId,
            sender: userRole,
            message: newMessage.trim(),
        };

        setNewMessage("");
        setLoading(true);

        try {
            await api.post("/chat/send", payload);
            setLoading(false);
        } catch (err) {
            console.error("Failed to send message:", err);
            setLoading(false);
        }
    };

    if (!emergencyRequestId) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] font-sans flex flex-col items-end">
            {/* Modular animation inject */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeInChat {
                    from { opacity: 0; transform: translateY(12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fadeInChat {
                    animation: fadeInChat 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}} />

            {/* Minimize Bubble */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-full shadow-2xl transition duration-300 hover:scale-105 border border-red-500/30 cursor-pointer"
                >
                    <FiMessageSquare className="w-5 h-5 animate-pulse text-white" />
                    <span className="text-[11px] uppercase tracking-wider font-extrabold">First Aid AI Chat</span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="w-[350px] h-[480px] bg-[#161a23]/95 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeInChat">

                    {/* Header */}
                    <div className="bg-[#1e2330]/80 border-b border-gray-800/85 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <div>
                                <h3 className="text-white text-xs font-bold uppercase tracking-wider">First Aid Assistant</h3>
                                <p className="text-[9px] text-gray-500 font-semibold leading-none mt-0.5">Real-time rescue protocol</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white p-1 hover:bg-[#12141c] rounded-lg transition"
                            title="Minimize"
                        >
                            <FiMinus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Message Log */}
                    <div className="flex-grow p-4 overflow-y-auto space-y-3">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <FiActivity className="w-8 h-8 text-red-500/40 animate-pulse mb-2" />
                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">No instructions logged yet</p>
                                <p className="text-[9px] text-gray-650 mt-1 leading-normal">Ask questions like "How to handle a burn?" or "Steps for CPR" to get quick, safety-focused advice.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isAI = msg.sender === "ai";
                                const isSelf = msg.sender === userRole;

                                return (
                                    <div
                                        key={msg._id || idx}
                                        className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                                    >
                                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mb-0.5 px-1 font-mono">
                                            {isAI ? "🤖 First Aid AI" : msg.sender === "patient" ? "👤 Patient" : "🚑 Paramedic"}
                                        </span>
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs font-semibold leading-relaxed break-words shadow ${isSelf
                                                    ? "bg-blue-600 text-white rounded-tr-none"
                                                    : isAI
                                                        ? "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50"
                                                        : "bg-[#1e2330] text-gray-200 rounded-tl-none border border-gray-800"
                                                }`}
                                        >
                                            {formatChatMessage(msg.message)}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Footer Form */}
                    <form onSubmit={handleSend} className="p-3 border-t border-gray-800/80 bg-[#1e2330]/40 flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a first aid question..."
                            className="flex-grow bg-[#1e2330] border border-gray-800 text-white rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-red-500 placeholder-gray-600 font-semibold"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !newMessage.trim()}
                            className="p-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl transition shadow flex items-center justify-center cursor-pointer disabled:opacity-40"
                        >
                            <FiSend className="w-4 h-4 text-white" />
                        </button>
                    </form>

                </div>
            )}
        </div>
    );
}

export default EmergencyChat;
