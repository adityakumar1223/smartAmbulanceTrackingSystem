import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api.js";
import socket from "../../socket/socket.js";
import { useAuth } from "../../context/AuthContext";
import LogoutButton from "../../components/LogoutButton.jsx";
import { 
  FiActivity, FiTruck, FiUsers, FiCompass, FiAlertCircle, FiSettings,
  FiInfo, FiFileText, FiClock, FiImage, FiX, FiThumbsUp, FiMessageCircle,
  FiSend, FiUserPlus, FiUser, FiMapPin, FiMenu
} from "react-icons/fi";

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
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
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
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
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
  }
];

// Initial Seed Data for Suggested Connections
const INITIAL_CONNECTIONS = [
  { id: "conn-1", name: "Dr. Sarah Adams", role: "Hospital Trauma Lead", avatar: "🏥", status: "none" },
  { id: "conn-2", name: "Paramedic John Miller", role: "Lead EMS Officer", avatar: "🚑", status: "none" },
  { id: "conn-3", name: "Dispatcher Emily Rose", role: "Central Dispatch", avatar: "📡", status: "none" }
];

function HospitalDashboard() {
  const { user } = useAuth();

  // NAVIGATION TABS
  const [activeTab, setActiveTab] = useState("community"); // "community", "radar", "config"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // BASE STATES FOR HOSPITAL
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------
  // TABS STATE: CAPACITY CONFIG (Persists in localStorage)
  // ----------------------------------------------------
  const [hospitalConfig, setHospitalConfig] = useState(() => {
    const saved = localStorage.getItem("hosp_config");
    return saved ? JSON.parse(saved) : {
      icuBeds: "8 Available",
      operatingTheaters: "3 prepped & idle",
      surgicalTeams: "12 trauma specialists ready",
      obgynWard: "Standby alert",
      hotline: "+91 11 2345 6789"
    };
  });
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState({ ...hospitalConfig });

  const handleSaveConfig = (e) => {
    e.preventDefault();
    setHospitalConfig(tempConfig);
    localStorage.setItem("hosp_config", JSON.stringify(tempConfig));
    setIsEditingConfig(false);
    alert("Trauma capacity ledger synchronized successfully!");
  };

  // ----------------------------------------------------
  // TABS STATE: EMBEDDED COMMUNITY (Syncs with standalone page)
  // ----------------------------------------------------
  const [communityTab, setCommunityTab] = useState("feed"); // "feed" or "hazards"
  const [posts, setPosts] = useState(() => {
    const saved = localStorage.getItem("com_posts");
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  });
  const [hazards, setHazards] = useState(() => {
    const saved = localStorage.getItem("com_hazards");
    return saved ? JSON.parse(saved) : INITIAL_HAZARDS;
  });
  const [connections, setConnections] = useState(() => {
    const saved = localStorage.getItem("com_connections");
    return saved ? JSON.parse(saved) : INITIAL_CONNECTIONS;
  });

  // Persist community changes to sync with main community page
  useEffect(() => {
    localStorage.setItem("com_posts", JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem("com_hazards", JSON.stringify(hazards));
  }, [hazards]);

  useEffect(() => {
    localStorage.setItem("com_connections", JSON.stringify(connections));
  }, [connections]);

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

  // Comments state
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});

  // Connect handler
  const handleConnectClick = (connId) => {
    setConnections(prev =>
      prev.map(conn => {
        if (conn.id === connId) {
          if (conn.status === "none") {
            setTimeout(() => {
              setConnections(curr =>
                curr.map(c => c.id === connId ? { ...c, status: "connected" } : c)
              );
            }, 800);
            return { ...conn, status: "pending" };
          }
          if (conn.status === "connected") {
            return { ...conn, status: "none" };
          }
        }
        return conn;
      })
    );
  };

  // Like handler
  const handleLikePost = (postId) => {
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post.id === postId) {
          const likedBy = post.likedBy || [];
          const hasLiked = likedBy.includes(user?.email);
          const newLikedBy = hasLiked
            ? likedBy.filter(email => email !== user?.email)
            : [...likedBy, user?.email];
          const newLikesCount = hasLiked ? Math.max(0, post.likes - 1) : post.likes + 1;
          return { ...post, likes: newLikesCount, likedBy: newLikedBy };
        }
        return post;
      })
    );
  };

  // Comment submit
  const handleSubmitComment = (postId) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post.id === postId) {
          const newComment = {
            id: `comment-${Date.now()}`,
            author: user?.name || "Anonymous",
            content: text
          };
          return { ...post, comments: [...post.comments, newComment] };
        }
        return post;
      })
    );
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
  };

  // Create post
  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPostText.trim() && !postImageBase64) return;

    const newPost = {
      id: `post-${Date.now()}`,
      author: {
        name: user?.name || "Anonymous Hospital",
        role: "hospital",
        avatar: "🏥"
      },
      content: newPostText,
      image: postImageBase64,
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString()
    };

    setPosts([newPost, ...posts]);
    setNewPostText("");
    setPostImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Photo uploads
  const handlePhotoClick = () => fileInputRef.current.click();
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPostImageBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Upvote hazard
  const handleUpvoteHazard = (hazardId) => {
    setHazards(prevHazards =>
      prevHazards.map(haz => {
        if (haz.id === hazardId) {
          const upvotedBy = haz.upvotedBy || [];
          const hasUpvoted = upvotedBy.includes(user?.email);
          if (hasUpvoted) {
            return {
              ...haz,
              upvotes: Math.max(0, haz.upvotes - 1),
              upvotedBy: upvotedBy.filter(email => email !== user?.email)
            };
          } else {
            return {
              ...haz,
              upvotes: haz.upvotes + 1,
              upvotedBy: [...upvotedBy, user?.email]
            };
          }
        }
        return haz;
      })
    );
  };

  // Create hazard
  const handleCreateHazard = (e) => {
    e.preventDefault();
    if (!hazardForm.route.trim() || !hazardForm.description.trim()) return;

    const newHazard = {
      id: `hazard-${Date.now()}`,
      route: hazardForm.route,
      type: hazardForm.type,
      severity: hazardForm.severity,
      description: hazardForm.description,
      upvotes: 0,
      upvotedBy: [],
      author: user?.name || "Anonymous Staff",
      createdAt: new Date().toISOString()
    };

    setHazards([newHazard, ...hazards]);
    setHazardForm({ route: "", type: "Potholes", severity: "medium", description: "" });
    alert("Road hazard broadcasted to emergency network!");
  };

  const sortedHazards = [...hazards].sort((a, b) => b.upvotes - a.upvotes);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await api.get("/emergency/all");
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error("Error fetching emergency requests for hospital:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();

    // Socket updates
    socket.on("emergencyRequest", (newRequest) => {
      setRequests(prev => [newRequest, ...prev]);
    });

    socket.on("emergencyStatusUpdated", (updatedRequest) => {
      setRequests(prev => prev.map(r => r._id === updatedRequest._id ? updatedRequest : r));
    });

    socket.on("emergencyAccepted", (updatedRequest) => {
      setRequests(prev => prev.map(r => r._id === updatedRequest._id ? updatedRequest : r));
    });

    return () => {
      socket.off("emergencyRequest");
      socket.off("emergencyStatusUpdated");
      socket.off("emergencyAccepted");
    };
  }, []);

  // Filter incoming emergencies (accepted, en route, or arrived)
  const incomingAmbulances = requests.filter(
    (r) => r.status === "accepted" || r.status === "on_the_way" || r.status === "arrived"
  );

  // Statistics calculation
  const totalIncoming = incomingAmbulances.length;
  const criticalCardiac = incomingAmbulances.filter(r => r.emergencyType === "heart_attack").length;
  const criticalAccident = incomingAmbulances.filter(r => r.emergencyType === "accident").length;
  const activePregnancy = incomingAmbulances.filter(r => r.emergencyType === "pregnancy").length;

  const stats = [
    { label: "Active Ambulances Incoming", value: totalIncoming, desc: "Ambulances en route", icon: <FiTruck className="w-5 h-5 text-red-400" />, color: "bg-red-500/10 border-red-500/20 text-red-400" },
    { label: "Cardiac Alerts", value: criticalCardiac, desc: "Triage room required", icon: <FiAlertCircle className="w-5 h-5 text-yellow-400" />, color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" },
    { label: "Trauma Accidents", value: criticalAccident, desc: "Surgical crew on standby", icon: <FiActivity className="w-5 h-5 text-purple-400" />, color: "bg-purple-500/10 border-purple-500/20 text-purple-400" },
    { label: "Pregnancy Cases", value: activePregnancy, desc: "OBGYN ward notified", icon: <FiUsers className="w-5 h-5 text-green-400" />, color: "bg-green-500/10 border-green-500/20 text-green-400" },
  ];

  return (
    <div className="min-h-screen bg-[#0e1015] text-[#9ca3af] font-sans flex flex-col md:flex-row w-full overflow-hidden">
      
      {/* ----------------------------------------------------
          1. LEFT SIDEBAR / NAVIGATION BAR (Desktop Viewport)
          ---------------------------------------------------- */}
      <aside className="hidden md:flex flex-col justify-between w-72 h-screen sticky top-0 bg-[#161a23] border-r border-gray-800/80 p-6 flex-shrink-0 z-40">
        
        <div className="space-y-8">
          {/* Brand/Logo Section */}
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2.5 rounded-2xl text-red-500 shadow-md flex-shrink-0">
              <FiActivity className="w-6 h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <span className="text-lg font-bold text-white tracking-tight leading-none whitespace-nowrap block">SmartAmbulance</span>
              <p className="text-[10px] text-gray-500 font-medium mt-1 whitespace-nowrap">Unified Hospital Portal</p>
            </div>
          </div>

          {/* User quick profile metadata card */}
          <div className="flex items-center gap-3 p-3 bg-[#1e2330]/50 rounded-2xl border border-gray-800/60">
            <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
              🏥
            </div>
            <div className="overflow-hidden min-w-0">
              <h4 className="text-white text-xs font-bold truncate leading-tight whitespace-nowrap">{user?.name}</h4>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-semibold mt-0.5 truncate whitespace-nowrap">{user?.role}</p>
            </div>
          </div>

          {/* Sidebar Tabs Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("community")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "community"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiUsers className="w-4.5 h-4.5" />
              <span>Community Hub</span>
            </button>

            <button
              onClick={() => setActiveTab("radar")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "radar"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiCompass className="w-4.5 h-4.5" />
              <span>Triage Radar</span>
              {totalIncoming > 0 && (
                <span className="ml-auto bg-red-500 text-white font-bold font-mono px-1.5 py-0.5 text-[9px] rounded-full animate-pulse">{totalIncoming}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("config")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "config"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiSettings className="w-4.5 h-4.5" />
              <span>Trauma Config</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Docked Logout Area at the Bottom */}
        <div className="pt-6 border-t border-gray-800/80">
          <LogoutButton className="w-full justify-center" />
        </div>
      </aside>

      {/* ----------------------------------------------------
          2. RESPONSIVE HEADER BAR (Mobile/Tablet Viewport)
          ---------------------------------------------------- */}
      <header className="md:hidden border-b border-gray-800 bg-[#161a23]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center w-full flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <FiActivity className="w-5.5 h-5.5 text-red-500 animate-pulse" />
          <span className="text-md font-bold text-white tracking-tight leading-none whitespace-nowrap block">SmartAmbulance</span>
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/40 rounded-xl transition cursor-pointer"
        >
          {mobileMenuOpen ? (
            <FiX className="w-5 h-5" />
          ) : (
            <FiMenu className="w-5 h-5" />
          )}
        </button>

        {mobileMenuOpen && (
          <div className="absolute right-6 top-16 bg-[#161a23]/95 backdrop-blur-xl border border-gray-800/80 rounded-2xl p-4 w-52 shadow-2xl flex flex-col gap-2 z-50 animate-fadeIn">
            <button
              onClick={() => { setActiveTab("community"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 ${
                activeTab === "community" ? "bg-red-500/10 text-red-400" : "text-gray-400"
              }`}
            >
              <FiUsers className="w-3.5 h-3.5" />
              <span>Community</span>
            </button>
            <button
              onClick={() => { setActiveTab("radar"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 ${
                activeTab === "radar" ? "bg-red-500/10 text-red-400" : "text-gray-400"
              }`}
            >
              <FiCompass className="w-3.5 h-3.5" />
              <span>Triage Radar</span>
            </button>
            <button
              onClick={() => { setActiveTab("config"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 ${
                activeTab === "config" ? "bg-red-500/10 text-red-400" : "text-gray-400"
              }`}
            >
              <FiSettings className="w-3.5 h-3.5" />
              <span>Trauma Config</span>
            </button>
            <div className="border-t border-gray-800/80 pt-2 mt-1">
              <LogoutButton />
            </div>
          </div>
        )}
      </header>

      {/* ----------------------------------------------------
          3. MAIN CONTAINER VIEWPORT (Responsive right workspace)
          ---------------------------------------------------- */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* ====================================================
            VIEWPORT A: EMBEDDED COMMUNITY TABS (Unified Layout)
            ==================================================== */}
        {activeTab === "community" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Embedded Header and Subtabs selector */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#161a23]/60 p-4 border border-gray-800 rounded-3xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiUsers className="text-red-500" />
                  <span>Community Network Hub</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Connect, coordinate route updates, and warning bulletins.</p>
              </div>

              <div className="flex bg-[#1e2330] p-1 rounded-xl border border-gray-800">
                <button
                  onClick={() => setCommunityTab("feed")}
                  className={`py-1.5 px-3 text-[10px] uppercase font-bold rounded-lg transition ${
                    communityTab === "feed"
                      ? "bg-red-500/10 text-red-400"
                      : "text-gray-500 hover:text-gray-400"
                  }`}
                >
                  Stream Feed
                </button>
                <button
                  onClick={() => setCommunityTab("hazards")}
                  className={`py-1.5 px-3 text-[10px] uppercase font-bold rounded-lg transition ${
                    communityTab === "hazards"
                      ? "bg-red-500/10 text-red-400"
                      : "text-gray-500 hover:text-gray-400"
                  }`}
                >
                  Hazard Alerts ({hazards.length})
                </button>
              </div>
            </div>

            {communityTab === "feed" ? (
              /* TAB B1: stream feed */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Write post and feed lists */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Share an update builder card */}
                  <div className="bg-[#161a23]/90 border border-gray-800 p-5 rounded-3xl shadow-xl">
                    <form onSubmit={handleCreatePost} className="space-y-3">
                      <textarea
                        rows="2"
                        value={newPostText}
                        onChange={(e) => setNewPostText(e.target.value)}
                        placeholder={`Broadcast a triage or ward notice update, Dr. ${user?.name}?`}
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-2xl p-3 text-xs focus:outline-none focus:border-red-500 transition placeholder-gray-600 resize-none font-semibold"
                      ></textarea>

                      {postImageBase64 && (
                        <div className="relative inline-block mt-1">
                          <img src={postImageBase64} alt="Preview" className="max-h-36 rounded-xl border border-gray-800 object-cover" />
                          <button
                            type="button"
                            onClick={() => setPostImageBase64(null)}
                            className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white p-1 rounded-full shadow"
                          >
                            <FiX className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t border-gray-800/80">
                        <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" className="hidden" />
                        <button
                          type="button"
                          onClick={handlePhotoClick}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-red-400 transition"
                        >
                          <FiImage className="w-4 h-4" />
                          <span>Photo</span>
                        </button>

                        <button
                          type="submit"
                          disabled={!newPostText.trim() && !postImageBase64}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl text-[10px] transition disabled:opacity-40 uppercase tracking-wide"
                        >
                          <FiSend className="w-3 h-3" />
                          <span>Publish</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Scrollable feed stream */}
                  <div className="space-y-6">
                    {posts.map(post => {
                      const isExpanded = expandedComments[post.id];
                      const hasLiked = post.likedBy?.includes(user?.email);

                      return (
                        <div key={post.id} className="bg-[#161a23] border border-gray-800 p-5 rounded-3xl shadow-lg space-y-3">
                           <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#1e2330] border border-gray-800 flex items-center justify-center text-md">
                              {post.author.avatar}
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-xs">{post.author.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-500">
                                <span className="bg-red-500/10 text-red-400 px-1 py-0.5 rounded uppercase font-bold">{post.author.role}</span>
                                <span className="flex items-center gap-0.5"><FiClock className="w-2.5 h-2.5" /> {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-gray-300 leading-relaxed font-semibold">{post.content}</p>

                          {post.image && (
                            <div className="border border-gray-800 rounded-2xl overflow-hidden max-h-[240px]">
                              <img src={post.image} alt="Upload" className="w-full h-full object-cover" />
                            </div>
                          )}

                          <div className="flex gap-4 items-center pt-2 border-t border-gray-800/60">
                            <button
                              onClick={() => handleLikePost(post.id)}
                              className={`flex items-center gap-1 text-[10px] font-bold transition ${hasLiked ? "text-red-500" : "text-gray-500 hover:text-red-400"}`}
                            >
                              <FiThumbsUp className="w-3.5 h-3.5" />
                              <span>{post.likes}</span>
                            </button>

                            <button
                              onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                              className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-red-400 transition"
                            >
                              <FiMessageCircle className="w-3.5 h-3.5" />
                              <span>{post.comments?.length || 0}</span>
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="pt-3 border-t border-gray-800/40 space-y-3">
                              {post.comments && post.comments.length > 0 && (
                                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                                  {post.comments.map(c => (
                                    <div key={c.id} className="text-[10px] bg-[#1e2330] p-2.5 rounded-xl border border-gray-900">
                                      <span className="font-bold text-white block mb-0.5">{c.author}</span>
                                      <span className="text-gray-400">{c.content}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={commentInputs[post.id] || ""}
                                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  placeholder="Write a comment..."
                                  className="flex-grow bg-[#1e2330] border border-gray-800 text-white rounded-xl px-3 py-1.5 text-[10px] focus:outline-none focus:border-red-500"
                                />
                                <button
                                  onClick={() => handleSubmitComment(post.id)}
                                  className="px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition flex items-center justify-center cursor-pointer"
                                >
                                  <FiSend className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Suggested Connections sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-[#161a23] border border-gray-800 p-5 rounded-3xl shadow-lg">
                    <h3 className="text-white font-bold text-xs uppercase tracking-wide border-b border-gray-800 pb-3 flex items-center gap-2">
                      <FiUsers className="text-red-500" />
                      <span>Suggested Medical Network</span>
                    </h3>
                    <div className="space-y-3 pt-3">
                      {connections.map(conn => (
                        <div key={conn.id} className="flex justify-between items-center p-2.5 bg-[#1e2330]/40 border border-gray-800/40 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{conn.avatar}</span>
                            <div>
                              <h4 className="text-white text-[10px] font-bold truncate leading-tight">{conn.name}</h4>
                              <p className="text-[8px] text-gray-500 mt-0.5">{conn.role}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleConnectClick(conn.id)}
                            className={`py-1 px-2.5 rounded-lg text-[9px] font-bold uppercase transition ${
                              conn.status === "connected"
                                ? "bg-green-500/10 text-green-400"
                                : conn.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-500 cursor-wait"
                                : "bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer"
                            }`}
                            disabled={conn.status === "pending"}
                          >
                            {conn.status === "connected" ? "Connected" : conn.status === "pending" ? "Syncing..." : "Connect"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB B2: road hazard bulletins upvote board */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Form to submit hazard */}
                <div className="lg:col-span-1 bg-[#161a23] border border-gray-800 p-5 rounded-3xl shadow-lg">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wide border-b border-gray-800 pb-3 flex items-center gap-2">
                    <FiAlertTriangle className="text-red-500" />
                    <span>Report Route Hazard</span>
                  </h3>
                  <form onSubmit={handleCreateHazard} className="space-y-4 pt-3 font-semibold text-[10px]">
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wide mb-1.5">Route/Road Name</label>
                      <input
                        type="text"
                        value={hazardForm.route}
                        onChange={(e) => setHazardForm({ ...hazardForm, route: e.target.value })}
                        placeholder="e.g. Sector 62 bypass bridge"
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wide mb-1.5">Category</label>
                      <select
                        value={hazardForm.type}
                        onChange={(e) => setHazardForm({ ...hazardForm, type: e.target.value })}
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-red-500"
                      >
                        <option value="Potholes">Severe Potholes</option>
                        <option value="Water-Logging">Water-Logging</option>
                        <option value="Construction">Construction</option>
                        <option value="Road Blocked">Road Obstruction</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wide mb-1.5">Severity</label>
                      <div className="grid grid-cols-3 gap-2">
                        {["low", "medium", "critical"].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setHazardForm({ ...hazardForm, severity: s })}
                            className={`py-1.5 rounded-lg border transition capitalize text-[9px] ${
                              hazardForm.severity === s
                                ? s === "critical" ? "bg-red-500/20 border-red-500 text-red-400" : "bg-amber-500/20 border-amber-500 text-amber-400"
                                : "bg-[#1e2330] border-gray-800 text-gray-500"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wide mb-1.5">Instructions</label>
                      <textarea
                        rows="2"
                        value={hazardForm.description}
                        onChange={(e) => setHazardForm({ ...hazardForm, description: e.target.value })}
                        placeholder="Suggest alternative lanes or detail road state..."
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 resize-none"
                      ></textarea>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition cursor-pointer"
                    >
                      Broadcast Alert
                    </button>
                  </form>
                </div>

                {/* Hazards upvote leaderboard list */}
                <div className="lg:col-span-2 bg-[#161a23] border border-gray-800 p-5 rounded-3xl shadow-lg">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase">Route Safety leaderboard</h4>
                      <p className="text-[10px] text-gray-500">Alerts upvoted by paramedics/patients. Critical blockages bubble to the top.</p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-4">
                    {sortedHazards.map(haz => {
                      const hasUpvoted = haz.upvotedBy?.includes(user?.email);

                      return (
                        <div key={haz.id} className="flex justify-between items-start gap-4 p-3 bg-[#1e2330]/50 border border-gray-800/40 rounded-2xl">
                          <div className="space-y-1 overflow-hidden">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold text-xs truncate">{haz.route}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                haz.severity === "critical" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                              }`}>{haz.type}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed font-medium">{haz.description}</p>
                            <div className="flex items-center gap-2 text-[9px] text-gray-500 mt-1">
                              <span>Reported by: <span className="font-bold text-gray-400">{haz.author}</span></span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleUpvoteHazard(haz.id)}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${
                              hasUpvoted 
                                ? "bg-red-500/20 border-red-500 text-red-400 font-bold"
                                : "bg-[#1e2330] border-gray-800 text-gray-500 hover:border-gray-700 cursor-pointer"
                            }`}
                          >
                            <FiThumbsUp className="w-3.5 h-3.5 mb-1" />
                            <span className="text-[10px]">{haz.upvotes}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================================================
            VIEWPORT B: LIVE HOSPITAL TRIAGE RADAR
            ==================================================== */}
        {activeTab === "radar" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, idx) => (
                <div key={idx} className="bg-[#161a23] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{stat.label}</span>
                      <p className="text-[9px] text-gray-600 mt-0.5">{stat.desc}</p>
                    </div>
                    <div className={`p-2 rounded-xl border ${stat.color}`}>{stat.icon}</div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Incoming Radar Grid */}
            <div className="bg-[#161a23] border border-gray-800 p-6 rounded-3xl shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FiCompass className="animate-spin text-red-500" />
                    <span>Live Incoming Ambulance Radar</span>
                  </h2>
                  <p className="text-xs text-gray-500">List of ambulances with active, en-route patient delivery states.</p>
                </div>
                <button
                  onClick={fetchIncidents}
                  className="py-2 px-4 bg-[#1e2330] hover:bg-gray-800 text-white border border-gray-800 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Sync Radar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Ambulance Unit</th>
                      <th className="py-3 px-4">Trauma priority</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">En Route Status</th>
                      <th className="py-3 px-4 hidden md:table-cell">Triage Notes</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Report Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-xs">
                    {incomingAmbulances.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          <FiTruck className="w-10 h-10 mx-auto mb-3 text-gray-700 animate-pulse" />
                          <span>No active incoming ambulances on radar. All clear.</span>
                        </td>
                      </tr>
                    ) : (
                      incomingAmbulances.map((req) => (
                        <tr key={req._id} className="hover:bg-[#1e2330]/20 transition">
                          <td className="py-4 px-4 font-bold text-white flex items-center gap-2">
                            <FiTruck className="text-red-500 animate-pulse" />
                            <span>Unit #{req._id.substring(req._id.length - 6).toUpperCase()}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize border ${
                              req.emergencyType === "heart_attack" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                              req.emergencyType === "accident" ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                              req.emergencyType === "pregnancy" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                              "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            }`}>
                              {req.emergencyType.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-semibold">{req.patientId?.name || "Anonymous Incident"}</td>
                          <td className="py-4 px-4">
                            <span className="flex items-center gap-1.5 text-blue-400 font-bold uppercase tracking-wider text-[10px]">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                              {req.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-4 px-4 max-w-xs truncate italic text-gray-400 hidden md:table-cell">
                            "{req.patientNotes || "No condition notes logged."}"
                          </td>
                          <td className="py-4 px-4 text-gray-500 hidden sm:table-cell">{new Date(req.createdAt).toLocaleTimeString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            VIEWPORT C: COMPREHENSIVE CAPACITY CONFIG VIEW
            ==================================================== */}
        {activeTab === "config" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            
            {/* Header Info badge */}
            <div className="bg-[#161a23] border border-gray-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-3xl shadow">
                🏥
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{user?.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Secure Trauma Facility Ledger: {user?.email}</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold uppercase rounded-md">
                    Emergency Triage Sync
                  </span>
                  <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[8px] font-bold uppercase rounded-md animate-pulse">
                    Websockets Enabled
                  </span>
                </div>
              </div>
            </div>

            {/* Config Form Cards */}
            <div className="bg-[#161a23] border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 border border-dashed border-red-500/10 rounded-full translate-x-8 -translate-y-8 select-none"></div>

              <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-6">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <FiFileText className="text-red-500" />
                  <span>Trauma Capacity Settings</span>
                </h3>
                
                {!isEditingConfig ? (
                  <button
                    onClick={() => { setTempConfig({ ...hospitalConfig }); setIsEditingConfig(true); }}
                    className="py-1 px-3.5 bg-[#1e2330] hover:bg-[#252b3a] border border-gray-800 text-white font-bold rounded-xl text-[10px] uppercase transition cursor-pointer"
                  >
                    Edit Capacity
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingConfig(false)}
                      className="py-1 px-3.5 bg-transparent border border-gray-800 text-gray-400 hover:text-white font-bold rounded-xl text-[10px] uppercase transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {!isEditingConfig ? (
                /* Static view mode */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">ICU Beds Pool</span>
                    <span className="text-sm font-black text-red-500">{hospitalConfig.icuBeds}</span>
                  </div>

                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Operating Theaters Ready</span>
                    <span className="text-sm font-black text-white">{hospitalConfig.operatingTheaters}</span>
                  </div>

                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl md:col-span-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Surgical Specialists Standby</span>
                    <p className="text-xs font-bold text-gray-300">{hospitalConfig.surgicalTeams}</p>
                  </div>

                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl md:col-span-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">OBGYN Ward Status</span>
                    <p className="text-xs font-bold text-green-400/90">{hospitalConfig.obgynWard}</p>
                  </div>

                  <div className="border border-blue-900/40 p-4 bg-blue-950/10 rounded-2xl md:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-blue-400/80 uppercase tracking-widest font-bold block mb-1">Trauma Hotline</span>
                      <p className="text-sm font-black text-blue-300 mt-0.5">{hospitalConfig.hotline}</p>
                    </div>
                    <span className="text-2xl animate-pulse">📞</span>
                  </div>
                </div>
              ) : (
                /* Editable form mode */
                <form onSubmit={handleSaveConfig} className="space-y-4 font-mono text-[10px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">ICU Beds Pool</label>
                      <input
                        type="text"
                        value={tempConfig.icuBeds}
                        onChange={(e) => setTempConfig({ ...tempConfig, icuBeds: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">Operating Theaters Ready</label>
                      <input
                        type="text"
                        value={tempConfig.operatingTheaters}
                        onChange={(e) => setTempConfig({ ...tempConfig, operatingTheaters: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">Surgical Specialists Standby</label>
                      <input
                        type="text"
                        value={tempConfig.surgicalTeams}
                        onChange={(e) => setTempConfig({ ...tempConfig, surgicalTeams: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">OBGYN Ward Status</label>
                      <input
                        type="text"
                        value={tempConfig.obgynWard}
                        onChange={(e) => setTempConfig({ ...tempConfig, obgynWard: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">Trauma Hotline</label>
                      <input
                        type="text"
                        value={tempConfig.hotline}
                        onChange={(e) => setTempConfig({ ...tempConfig, hotline: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-800 flex justify-end">
                    <button
                      type="submit"
                      className="py-2 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-xs uppercase transition tracking-wider cursor-pointer"
                    >
                      Save & Sync Capacity
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Safety Information Box */}
            <div className="bg-gradient-to-br from-[#161a23] to-[#1a1f2c] border border-gray-800 p-5 rounded-3xl flex gap-3 text-xs leading-relaxed">
              <FiInfo className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="font-bold text-white uppercase tracking-wider">Triage Readiness Integrity Protocol</h4>
                <p className="text-gray-500 mt-1">
                  The trauma capacity levels configured here are automatically synchronized live to incoming ambulance paramedic units, allowing them to route emergency cardiac, trauma, or OBGYN cases immediately to the nearest cleared and prepped hospital node. Keeping this ledger updated saves critical minutes in emergency delivery.
                </p>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}

export default HospitalDashboard;