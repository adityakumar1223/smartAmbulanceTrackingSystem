import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  FiActivity, FiUser, FiThumbsUp, FiMessageCircle, FiPlus, 
  FiImage, FiUsers, FiAlertTriangle, FiMapPin, FiArrowUp, 
  FiClock, FiSend, FiX, FiCheck, FiUserPlus, FiInfo
} from "react-icons/fi";
import api from "../../services/api.js";
import socket from "../../socket/socket.js";

// Initial Seed Data for the Social Feed
const INITIAL_POSTS = [
  {
    id: "post-1",
    author: {
      name: "Paramedic John Miller",
      role: "driver",
      avatar: "🚑"
    },
    content: "Just cleared the main Highway 101 intersection near the bridge! The earlier heavy traffic bottleneck has fully subsided. Responding ambulance units can now take this route freely with zero delays. Stay safe out there, crew!",
    image: null,
    likes: 18,
    likedBy: [],
    comments: [
      { id: "c-1", author: "Dispatcher Emily Rose", content: "Great update, John! Relaying this to Unit 14 immediately." },
      { id: "c-2", author: "Dr. Sarah Adams", content: "Superb. We have an incoming trauma unit headed that way now." }
    ],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: "post-2",
    author: {
      name: "Dr. Sarah Adams",
      role: "hospital",
      avatar: "🏥"
    },
    content: "Trauma Ward A and our cardiovascular response teams are fully prepared and on standby for any incoming emergency incidents today. We have prepped 3 additional surgical rooms and assigned specialist supervisors. Let's save some lives!",
    image: "https://images.unsplash.com/photo-1584515906247-4b4c407fcc1d?auto=format&fit=crop&w=600&q=80",
    likes: 32,
    likedBy: [],
    comments: [
      { id: "c-3", author: "Aditya Kumar", content: "Thank you for all your dedication and service, Doctor! 🙏" }
    ],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString() // 5 hours ago
  },
  {
    id: "post-3",
    author: {
      name: "Aditya Kumar",
      role: "patient",
      avatar: "👤"
    },
    content: "Huge shoutout to the paramedic dispatch crew who responded within 4 minutes flat to my cardiac distress alert last night. Their composure and swift navigation on the maps were truly lifesaving. I am resting stable now. Thank you, SmartAmbulance!",
    image: null,
    likes: 45,
    likedBy: [],
    comments: [
      { id: "c-4", author: "Paramedic John Miller", content: "Glad we could reach you in time, Aditya! Keep resting well." }
    ],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString() // 12 hours ago
  }
];

// Initial Seed Data for the Road Hazards Bulletin
const INITIAL_HAZARDS = [
  {
    id: "hazard-1",
    route: "Highway 101 Crossing (Northbound)",
    type: "Potholes",
    severity: "critical",
    description: "Massive, deep potholes in the middle and left lanes right before the bypass bridge. Extremely dangerous for high-speed ambulance transit as it can damage suspension or cause sudden swerving!",
    upvotes: 14,
    upvotedBy: [],
    author: "Paramedic John Miller",
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: "hazard-2",
    route: "East Valley Boulevard Underpass",
    type: "Water-Logging",
    severity: "critical",
    description: "Water main burst has completely flooded the underpass, rendering it impassable for standard vehicles and risky for emergency rigs. Traffic is fully backed up. Direct dispatch detours are required via West Road!",
    upvotes: 21,
    upvotedBy: [],
    author: "Aditya Kumar",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
  },
  {
    id: "hazard-3",
    route: "Broadway Avenue (Intersecting 5th St)",
    type: "Construction",
    severity: "medium",
    description: "Active road resurfacing construction has narrowed traffic lanes to a single lane. Heavy delays during rush hour. Paramedics should use caution and consider using 7th Avenue as an alternative route.",
    upvotes: 6,
    upvotedBy: [],
    author: "Dr. Sarah Adams",
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
  }
];

// Initial Seed Data for Suggested Connections
const INITIAL_CONNECTIONS = [
  { id: "conn-1", name: "Dr. Sarah Adams", role: "Hospital Trauma Lead", avatar: "🏥", status: "none" },
  { id: "conn-2", name: "Paramedic John Miller", role: "Lead EMS Officer", avatar: "🚑", status: "none" },
  { id: "conn-3", name: "Dispatcher Emily Rose", role: "Central Dispatch", avatar: "📡", status: "none" },
  { id: "conn-4", name: "Nurse Mark Davis", role: "Emergency Ward Supervisor", avatar: "🩺", status: "none" }
];

export default function CommunityHub({ isDashboard = true }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("feed"); // "feed" or "hazards"

  // STATE: Social Feed Posts
  const [posts, setPosts] = useState([]);

  // STATE: Road Hazards
  const [hazards, setHazards] = useState([]);

  // STATE: Connections
  const [connections, setConnections] = useState(() => {
    const saved = localStorage.getItem("com_connections");
    return saved ? JSON.parse(saved) : INITIAL_CONNECTIONS;
  });

  // Persist Connections State to Local Storage
  useEffect(() => {
    localStorage.setItem("com_connections", JSON.stringify(connections));
  }, [connections]);

  // LOAD DATA & CONNECT WEBSOCKET FEED BROADCASTS ON MOUNT
  useEffect(() => {
    const fetchCommunityData = async () => {
      try {
        const postsRes = await api.get("/community/posts");
        const formattedPosts = (postsRes.data.posts || []).map(p => ({
          ...p,
          id: p._id
        }));
        setPosts(formattedPosts);

        const hazardsRes = await api.get("/community/hazards");
        const formattedHazards = (hazardsRes.data.hazards || []).map(h => ({
          ...h,
          id: h._id
        }));
        setHazards(formattedHazards);
      } catch (err) {
        console.error("Failed to retrieve global community hub datasets:", err);
      }
    };

    fetchCommunityData();

    // Socket.io Real-Time Synchronization Listeners
    socket.on("community_post_created", (newPost) => {
      setPosts(prev => {
        if (prev.some(p => p._id === newPost._id)) return prev;
        return [{ ...newPost, id: newPost._id }, ...prev];
      });
    });

    socket.on("community_post_updated", (updatedPost) => {
      setPosts(prev =>
        prev.map(p => p._id === updatedPost._id ? { ...updatedPost, id: updatedPost._id } : p)
      );
    });

    socket.on("community_hazard_created", (newHazard) => {
      setHazards(prev => {
        if (prev.some(h => h._id === newHazard._id)) return prev;
        return [{ ...newHazard, id: newHazard._id }, ...prev];
      });
    });

    socket.on("community_hazard_updated", (updatedHazard) => {
      setHazards(prev =>
        prev.map(h => h._id === updatedHazard._id ? { ...updatedHazard, id: updatedHazard._id } : h)
      );
    });

    return () => {
      socket.off("community_post_created");
      socket.off("community_post_updated");
      socket.off("community_hazard_created");
      socket.off("community_hazard_updated");
    };
  }, []);

  // Form states for creating a new post
  const [newPostText, setNewPostText] = useState("");
  const [postImageBase64, setPostImageBase64] = useState(null);
  const fileInputRef = useRef(null);

  // Form states for creating a road hazard complaint
  const [hazardForm, setHazardForm] = useState({
    route: "",
    type: "Potholes",
    severity: "medium",
    description: ""
  });

  // Comments state maps
  const [expandedComments, setExpandedComments] = useState({}); // { postId: boolean }
  const [commentInputs, setCommentInputs] = useState({}); // { postId: string }

  // Action: Handle simulated photo attachment
  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPostImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Action: Create social post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() && !postImageBase64) return;

    try {
      await api.post("/community/posts", {
        content: newPostText,
        image: postImageBase64
      });
      setNewPostText("");
      setPostImageBase64(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Failed to publish community post:", err);
      alert("Error broadcasting social post.");
    }
  };

  // Action: Like/Unlike Post
  const handleLikePost = async (postId) => {
    try {
      await api.post(`/community/posts/${postId}/like`);
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  // Action: Submit comment on post
  const handleSubmitComment = async (postId) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    try {
      const commentId = `comment-${Date.now()}`;
      await api.post(`/community/posts/${postId}/comment`, {
        id: commentId,
        author: user?.name || "Anonymous",
        content: text
      });
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  };

  // Action: Upvote hazard complaint
  const handleUpvoteHazard = async (hazardId) => {
    try {
      await api.post(`/community/hazards/${hazardId}/upvote`);
    } catch (err) {
      console.error("Failed to upvote hazard:", err);
    }
  };

  // Action: Submit new road hazard complaint
  const handleCreateHazard = async (e) => {
    e.preventDefault();
    if (!hazardForm.route.trim() || !hazardForm.description.trim()) return;

    try {
      await api.post("/community/hazards", {
        route: hazardForm.route,
        type: hazardForm.type,
        severity: hazardForm.severity,
        description: hazardForm.description
      });
      setHazardForm({
        route: "",
        type: "Potholes",
        severity: "medium",
        description: ""
      });
      alert("Road hazard alert published successfully!");
    } catch (err) {
      console.error("Failed to broadcast hazard alert:", err);
    }
  };

  // Action: Connect with Suggested Users
  const handleConnectClick = (connId) => {
    setConnections(prev =>
      prev.map(conn => {
        if (conn.id === connId) {
          if (conn.status === "none") {
            // Trigger animation "Pending..."
            setTimeout(() => {
              setConnections(curr =>
                curr.map(c => c.id === connId ? { ...c, status: "connected" } : c)
              );
            }, 1000);
            return { ...conn, status: "pending" };
          }
          if (conn.status === "connected") {
            // Unconnect
            return { ...conn, status: "none" };
          }
        }
        return conn;
      })
    );
  };

  // Sort hazards: Dynamic upvote-based sorting (highest upvotes bubble to top)
  const sortedHazards = [...hazards].sort((a, b) => b.upvotes - a.upvotes);

  const containerClasses = isDashboard 
    ? "space-y-6 animate-fadeIn" 
    : "flex-grow max-w-7xl w-full mx-auto px-6 py-8";

  return (
    <>
      {/* ----------------------------------------------------
          SUBNAV TABS SECTION (Responsive depending on environment)
          ---------------------------------------------------- */}
      {isDashboard ? (
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#161a23]/60 p-4 border border-gray-800 rounded-3xl">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FiUsers className="text-red-500" />
              <span>Community Network Hub</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Connect, coordinate route updates, and warning bulletins.
            </p>
          </div>

          <div className="flex bg-[#1e2330] p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setActiveTab("feed")}
              className={`py-1.5 px-3 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer ${
                activeTab === "feed"
                  ? "bg-red-500/10 text-red-400"
                  : "text-gray-500 hover:text-gray-400"
              }`}
            >
              Stream Feed
            </button>
            <button
              onClick={() => setActiveTab("hazards")}
              className={`py-1.5 px-3 text-[10px] uppercase font-bold rounded-lg transition cursor-pointer ${
                activeTab === "hazards"
                  ? "bg-red-500/10 text-red-400"
                  : "text-gray-500 hover:text-gray-400"
              }`}
            >
              Hazard Alerts ({hazards.length})
            </button>
          </div>
        </div>
      ) : (
        <section className="bg-[#161a23]/30 border-b border-gray-900 sticky top-[73px] z-40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 flex justify-start gap-6">
            <button
              onClick={() => setActiveTab("feed")}
              className={`py-4 px-2 text-sm font-bold tracking-wide transition border-b-2 flex items-center gap-2 uppercase cursor-pointer ${
                activeTab === "feed"
                  ? "border-red-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <FiUsers className="w-4 h-4" />
              <span>Community Feed</span>
            </button>

            <button
              onClick={() => setActiveTab("hazards")}
              className={`py-4 px-2 text-sm font-bold tracking-wide transition border-b-2 flex items-center gap-2 uppercase cursor-pointer ${
                activeTab === "hazards"
                  ? "border-red-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <FiAlertTriangle className="w-4 h-4" />
              <span>Road Hazards Bulletin</span>
            </button>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------
          MAIN CONTENT WORKSPACE
          ---------------------------------------------------- */}
      <div className={containerClasses}>
        {activeTab === "feed" ? (
          /* SOCIAL COMMUNITY FEED */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left/Middle Column: Post Maker & Posts Feed */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Write Post Card */}
              <div className="bg-[#161a23]/90 border border-gray-800 p-5 rounded-3xl shadow-xl backdrop-blur-lg">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  Share an Update
                </h3>
                
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <textarea
                    rows="3"
                    value={newPostText}
                    onChange={(e) => setNewPostText(e.target.value)}
                    placeholder={`What's happening on the routes, ${user?.name || "paramedic"}?`}
                    className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-2xl p-4 text-xs focus:outline-none focus:border-red-500 transition placeholder-gray-600 resize-none font-semibold leading-relaxed"
                  ></textarea>

                  {/* Thumbnail File Attachment Preview */}
                  {postImageBase64 && (
                    <div className="relative inline-block mt-2">
                      <img 
                        src={postImageBase64} 
                        alt="Preview" 
                        className="max-h-48 rounded-xl border border-gray-800 object-cover shadow-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-full shadow-md transition cursor-pointer flex items-center justify-center"
                      >
                        <FiX className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Attachment Controls */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={handlePhotoClick}
                      className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-red-400 transition cursor-pointer"
                    >
                      <FiImage className="w-4 h-4" />
                      <span>Attach Photo</span>
                    </button>

                    <button
                      type="submit"
                      disabled={!newPostText.trim() && !postImageBase64}
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl text-xs transition duration-200 shadow-md shadow-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider cursor-pointer"
                    >
                      <FiSend className="w-3.5 h-3.5" />
                      <span>Publish Post</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Social Posts Stream */}
              <div className="space-y-6">
                {posts.map((post) => {
                  const isExpanded = expandedComments[post.id];
                  const hasLiked = post.likedBy?.includes(user?.id);

                  return (
                    <div key={post.id} className="bg-[#161a23] border border-gray-800 p-6 rounded-3xl shadow-xl space-y-4">
                      {/* Post Author Metadata Header */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#1e2330] border border-gray-800 flex items-center justify-center text-lg shadow-sm">
                            {post.author.avatar}
                          </div>
                          <div>
                            <h4 className="text-white font-bold text-sm tracking-tight">{post.author.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                post.author.role === "driver" 
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : post.author.role === "hospital"
                                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  : post.author.role === "admin"
                                  ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                                  : "bg-red-500/10 text-red-500 border border-red-500/20"
                              }`}>
                                {post.author.role === "driver" ? "Paramedic" : post.author.role}
                              </span>
                              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                <FiClock className="w-3 h-3" />
                                {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Post Body Content */}
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-semibold">{post.content}</p>

                      {/* Attached Image */}
                      {post.image && (
                        <div className="border border-gray-800 rounded-2xl overflow-hidden shadow-inner max-h-[350px]">
                          <img 
                            src={post.image} 
                            alt="Post upload" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Post Reactions Grid Footer */}
                      <div className="flex gap-6 items-center pt-3 border-t border-gray-800/60">
                        <button
                          onClick={() => handleLikePost(post.id)}
                          className={`flex items-center gap-2 text-xs font-bold transition cursor-pointer ${
                            hasLiked 
                              ? "text-red-500 animate-pulse" 
                              : "text-gray-500 hover:text-red-400"
                          }`}
                        >
                          <FiThumbsUp className={`w-4 h-4 ${hasLiked ? "fill-red-500/20" : ""}`} />
                          <span>{post.likes} Likes</span>
                        </button>

                        <button
                          onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                          className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-red-400 transition cursor-pointer"
                        >
                          <FiMessageCircle className="w-4 h-4" />
                          <span>{post.comments?.length || 0} Comments</span>
                        </button>
                      </div>

                      {/* Collapsible Comments Section Drawer */}
                      {isExpanded && (
                        <div className="pt-4 border-t border-gray-800/40 space-y-4 animate-fadeIn">
                          
                          {/* Comments Stream */}
                          {post.comments && post.comments.length > 0 && (
                            <div className="space-y-3 bg-[#1e2330]/40 p-4 rounded-2xl border border-gray-800/40 max-h-[250px] overflow-y-auto">
                              {post.comments.map((comment) => (
                                <div key={comment.id} className="text-xs bg-[#1e2330] border border-gray-900 p-3 rounded-xl">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-white tracking-tight">{comment.author}</span>
                                  </div>
                                  <p className="text-gray-400 leading-relaxed">{comment.content}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Write Comment Box */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentInputs[post.id] || ""}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="Write a comment..."
                              className="flex-grow bg-[#1e2330] border border-gray-800 text-white rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-red-500 transition placeholder-gray-600 font-semibold"
                            />
                            <button
                              onClick={() => handleSubmitComment(post.id)}
                              className="px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition flex items-center justify-center cursor-pointer"
                            >
                              <FiSend className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

            </div>

            {/* Right Column: Suggested Medical Connections Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-[#161a23] border border-gray-800 p-5 rounded-3xl shadow-xl space-y-6">
                <div className="border-b border-gray-800 pb-4">
                  <h3 className="text-white font-bold text-xs flex items-center gap-2 uppercase tracking-wide">
                    <FiUsers className="text-red-500 w-4 h-4" />
                    Suggested Medical Network
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">Connect with trauma coordinators, dispatch crew, and hospital staff.</p>
                </div>

                <div className="space-y-4">
                  {connections.map((conn) => (
                    <div key={conn.id} className="flex justify-between items-center p-3 bg-[#1e2330]/50 border border-gray-800/40 rounded-2xl">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#1e2330] border border-gray-800 flex items-center justify-center text-md shadow-sm">
                          {conn.avatar}
                        </div>
                        <div>
                          <h4 className="text-white text-xs font-bold tracking-tight leading-tight">{conn.name}</h4>
                          <p className="text-[10px] text-gray-500 font-medium">{conn.role}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleConnectClick(conn.id)}
                        className={`py-1.5 px-3 rounded-xl text-[10px] font-bold transition flex items-center gap-1 uppercase tracking-wider ${
                          conn.status === "connected"
                            ? "bg-green-500/10 border border-green-500/20 text-green-400"
                            : conn.status === "pending"
                            ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 cursor-not-allowed"
                            : "bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 cursor-pointer"
                        }`}
                        disabled={conn.status === "pending"}
                      >
                        {conn.status === "connected" ? (
                          <>
                            <FiCheck className="w-3 h-3" />
                            <span>Connected</span>
                          </>
                        ) : conn.status === "pending" ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping"></span>
                            <span>Pending...</span>
                          </>
                        ) : (
                          <>
                            <FiUserPlus className="w-3 h-3" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informational Widget */}
              <div className="bg-gradient-to-br from-[#161a23] to-[#1a1f2c] border border-gray-800 p-6 rounded-3xl shadow-xl flex gap-3 text-xs leading-relaxed">
                <FiInfo className="w-6 h-6 text-red-400 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1 uppercase tracking-wide">Community Integrity</h4>
                  <p className="text-gray-500">
                    This community hub is a dedicated workspace for smart emergency coordination. Please post only validated updates and safety alerts regarding emergency routes.
                  </p>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* ROAD HAZARDS BULLETIN UPVOTE BOARD */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Register a New Hazard Form */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-[#161a23] border border-gray-800 p-5 rounded-3xl shadow-xl space-y-6">
                <div className="border-b border-gray-800 pb-4">
                  <h3 className="text-white font-bold text-xs flex items-center gap-2 uppercase tracking-wide">
                    <FiAlertTriangle className="text-red-500 w-4 h-4" />
                    Report Route Hazard
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">Found a blocked road or heavy pothole lane? Log it below to warn other dispatchers.</p>
                </div>

                <form onSubmit={handleCreateHazard} className="space-y-4">
                  {/* Route Location Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Route / Road Location</label>
                    <div className="relative">
                      <FiMapPin className="absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type="text"
                        value={hazardForm.route}
                        onChange={(e) => setHazardForm({ ...hazardForm, route: e.target.value })}
                        placeholder="e.g. West Main Street Highway"
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-red-500 transition placeholder-gray-600 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Hazard Type Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Hazard Category</label>
                    <select
                      value={hazardForm.type}
                      onChange={(e) => setHazardForm({ ...hazardForm, type: e.target.value })}
                      className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-red-500 transition font-semibold"
                    >
                      <option value="Potholes">Severe Potholes</option>
                      <option value="Water-Logging">Water-Logging / Flooding</option>
                      <option value="Construction">Active Road Construction</option>
                      <option value="Road Blocked">Full Road Obstruction / Closed</option>
                    </select>
                  </div>

                  {/* Severity Badge Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Transit Severity</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["low", "medium", "critical"].map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setHazardForm({ ...hazardForm, severity: sev })}
                          className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition capitalize cursor-pointer ${
                            hazardForm.severity === sev
                              ? sev === "critical"
                                ? "bg-red-500/20 border-red-500 text-red-400"
                                : sev === "medium"
                                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                                : "bg-green-500/20 border-green-500 text-green-400"
                              : "bg-[#1e2330] border-gray-800 text-gray-500 hover:border-gray-700"
                          }`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hazard Description notes */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Incident Details / Instructions</label>
                    <textarea
                      rows="3"
                      value={hazardForm.description}
                      onChange={(e) => setHazardForm({ ...hazardForm, description: e.target.value })}
                      placeholder="e.g. Lanes narrowed down. Suggest taking East Ring Road instead..."
                      required
                      className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl p-4 text-xs focus:outline-none focus:border-red-500 transition placeholder-gray-600 resize-none leading-relaxed font-semibold"
                    ></textarea>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-xs transition duration-200 shadow-md shadow-red-950/20 uppercase tracking-wider cursor-pointer"
                  >
                    Broadcast Hazard Alert
                  </button>
                </form>

              </div>

            </div>

            {/* Right/Middle Column: Hazards List sorted by UPVOTES */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-[#161a23] border border-gray-800 p-5 rounded-3xl shadow-xl space-y-6">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                  <div>
                    <h2 className="text-white font-bold text-sm uppercase">Active Hazards Board</h2>
                    <p className="text-[10px] text-gray-500 mt-0.5">Voted and reported by ambulance crews and dispatchers. **Highest upvoted bubble to the top**.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-[#1e2330] border border-gray-800 rounded-xl text-[10px] font-bold text-red-400 uppercase tracking-wider">
                    {sortedHazards.length} alerts active
                  </span>
                </div>

                <div className="space-y-4">
                  {sortedHazards.map((haz) => {
                    const hasUpvoted = haz.upvotedBy?.includes(user?.id);

                    return (
                      <div 
                        key={haz.id} 
                        className={`flex gap-4 p-5 bg-[#1e2330]/40 border rounded-2xl transition duration-300 ${
                          haz.severity === "critical"
                            ? "border-red-500/20 hover:border-red-500/40 hover:shadow-red-950/5"
                            : "border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        
                        {/* UPVOTE COLUMN INDICATOR */}
                        <div className="flex flex-col items-center justify-start gap-1">
                          <button
                            onClick={() => handleUpvoteHazard(haz.id)}
                            className={`p-2 rounded-xl transition border cursor-pointer ${
                              hasUpvoted
                                ? "bg-red-500/10 border-red-500 text-red-500 shadow-lg shadow-red-950/10"
                                : "bg-[#1e2330] border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700"
                            }`}
                          >
                            <FiArrowUp className="w-5 h-5" />
                          </button>
                          <span className={`text-xs font-bold mt-1 ${hasUpvoted ? "text-red-500" : "text-gray-400"}`}>
                            {haz.upvotes}
                          </span>
                        </div>

                        {/* CONTENT WRAPPER */}
                        <div className="flex-grow space-y-2 overflow-hidden">
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 leading-none">
                              <span className={`w-2 h-2 rounded-full ${
                                haz.severity === "critical" ? "bg-red-500 animate-ping" : "bg-amber-500"
                              }`}></span>
                              {haz.route}
                            </h4>

                            <div className="flex gap-2">
                              {/* Hazard Category Tag */}
                              <span className="px-2 py-0.5 bg-gray-500/10 border border-gray-800 text-gray-400 rounded-lg text-[9px] font-bold uppercase tracking-wider leading-none">
                                {haz.type.replace("_", " ")}
                              </span>
                              
                              {/* Severity Badge */}
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider leading-none ${
                                haz.severity === "critical"
                                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                  : haz.severity === "medium"
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                                  : "bg-green-500/10 border border-green-500/20 text-green-400"
                              }`}>
                                {haz.severity}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 leading-relaxed font-semibold">{haz.description}</p>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-gray-800/40 text-[10px] text-gray-600">
                            <span>Logged by: <span className="text-gray-400 font-bold">{haz.author}</span></span>
                            <span className="flex items-center gap-1">
                              <FiClock className="w-3 h-3" />
                              {new Date(haz.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}
      </div>
    </>
  );
}
