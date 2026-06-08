import { useState, useEffect, useRef } from "react";
import { Link } from 'react-router-dom';
import LogoutButton from '../../components/LogoutButton.jsx';
import Radar from "radar-sdk-js";
import EmergencyForm from "./EmergencyForm.jsx";
import ActiveTripCard from "./ActiveTripCard.jsx";
import { useEmergency } from "../../context/EmergencyContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api.js";
import socket from "../../socket/socket.js";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { 
  FiActivity, FiUser, FiMapPin, FiPhoneCall, FiUsers, 
  FiAlertTriangle, FiPlus, FiThumbsUp, FiMessageCircle, FiSend, 
  FiImage, FiX, FiCheck, FiUserPlus, FiInfo, FiClock, FiSettings,
  FiFileText, FiChevronRight, FiCheckCircle, FiCompass, FiMenu
} from "react-icons/fi";

// Initial Seed Data for the Social Feed (matches standalone Community page)
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

function PatientDashboard() {
  const { activeEmergency } = useEmergency();
  const { user } = useAuth();
  
  // NAVIGATION ACTIVE TAB
  const [activeTab, setActiveTab] = useState("map"); // "community", "map", "profile", "location"
  
  // MOBILE NAVIGATION SLIDE OUT
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ----------------------------------------------------
  // GPS LIVE LOCATION TRACKER (Always Pinned Map Section)
  // ----------------------------------------------------
  const [userLocation, setUserLocation] = useState({ lat: 25.591, lng: 85.1376 }); // Seeded center
  const [gpsError, setGpsError] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isGpsActive, setIsGpsActive] = useState(false);

  useEffect(() => {
    if (user) {
      Radar.setUserId(user.id || user._id);
      Radar.setMetadata({
        name: user.name,
        email: user.email,
        role: user.role
      });
    }

    // Initial check-in location via Radar
    Radar.trackOnce()
      .then((result) => {
        if (result && result.location) {
          setUserLocation({
            lat: result.location.latitude,
            lng: result.location.longitude
          });
          setIsGpsActive(true);
        }
      })
      .catch((err) => console.warn("Initial Radar tracking failed:", err));

    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }

    const handleSuccess = (position) => {
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setGpsAccuracy(position.coords.accuracy);
      setIsGpsActive(true);
      setGpsError(null);

      // Sync position to Radar Platform in background
      Radar.trackOnce()
        .then((result) => {
          if (result && result.location) {
            console.log("Radar patient location synced:", result.location);
          }
        })
        .catch((err) => console.warn("Background Radar sync failed:", err));
    };

    const handleError = (error) => {
      console.warn("watchPosition warning:", error);
      setGpsError(error.message);
      setIsGpsActive(false);
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user]);

  // Broadcast patient live location to assigned driver
  useEffect(() => {
    if (
      activeEmergency &&
      ["accepted", "on_the_way", "arrived"].includes(activeEmergency.status) &&
      userLocation
    ) {
      const payload = {
        emergencyId: activeEmergency._id,
        patientId: user?.id,
        lat: userLocation.lat,
        lng: userLocation.lng
      };
      socket.emit("patientLocationUpdate", payload);
      console.log("Patient live location emitted via WebSockets:", payload);
    }
  }, [userLocation, activeEmergency, user?.id]);

  // ----------------------------------------------------
  // TABS STATE: PROFILE
  // ----------------------------------------------------
  const [profileData, setProfileData] = useState(() => {
    const saved = localStorage.getItem("pat_profile");
    return saved ? JSON.parse(saved) : {
      bloodGroup: "O Positive (O+)",
      insuranceId: "MAX-98234-UP",
      allergies: "Penicillin, Sulfa drugs",
      conditions: "Hypertension, Mild Asthma",
      emergencyContactName: "Father (Ramesh Kumar)",
      emergencyContactPhone: "+91 98765 43210"
    };
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState({ ...profileData });

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfileData(tempProfile);
    localStorage.setItem("pat_profile", JSON.stringify(tempProfile));
    setIsEditingProfile(false);
    alert("Medical emergency ledger synchronized successfully!");
  };

  // ----------------------------------------------------
  // TABS STATE: EMBEDDED COMMUNITY (BUG-05: Now synced with backend API)
  // ----------------------------------------------------
  const [communityTab, setCommunityTab] = useState("feed"); // "feed" or "hazards"
  const [posts, setPosts] = useState([]);
  const [hazards, setHazards] = useState([]);
  const [connections, setConnections] = useState(INITIAL_CONNECTIONS);

  // Fetch community data from backend API on mount (BUG-05)
  useEffect(() => {
    const fetchCommunityData = async () => {
      try {
        const [postsRes, hazardsRes] = await Promise.all([
          api.get("/community/posts"),
          api.get("/community/hazards")
        ]);
        setPosts((postsRes.data.posts || []).map(p => ({ ...p, id: p._id || p.id })));
        setHazards((hazardsRes.data.hazards || []).map(h => ({ ...h, id: h._id || h.id })));
      } catch (err) {
        console.error("Failed to fetch community data:", err);
      }
    };
    fetchCommunityData();
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

  // Like handler (BUG-05: now calls backend API)
  const handleLikePost = async (postId) => {
    try {
      const res = await api.post(`/community/posts/${postId}/like`);
      const updated = { ...res.data, id: res.data._id || res.data.id };
      setPosts(prev => prev.map(p => p.id === postId ? updated : p));
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  // Comment submit (BUG-05: now calls backend API)
  const handleSubmitComment = async (postId) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    try {
      const res = await api.post(`/community/posts/${postId}/comment`, {
        content: text,
        author: user?.name || "Anonymous"
      });
      const updated = { ...res.data, id: res.data._id || res.data.id };
      setPosts(prev => prev.map(p => p.id === postId ? updated : p));
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error("Failed to submit comment:", err);
    }
  };

  // Create post (BUG-05: now calls backend API)
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() && !postImageBase64) return;

    try {
      const res = await api.post("/community/posts", {
        content: newPostText,
        image: postImageBase64
      });
      const newPost = { ...res.data, id: res.data._id || res.data.id };
      setPosts(prev => [newPost, ...prev]);
      setNewPostText("");
      setPostImageBase64(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Failed to create post:", err);
    }
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

  // Upvote hazard (BUG-05: now calls backend API)
  const handleUpvoteHazard = async (hazardId) => {
    try {
      const res = await api.post(`/community/hazards/${hazardId}/upvote`);
      const updated = { ...res.data, id: res.data._id || res.data.id };
      setHazards(prev => prev.map(h => h.id === hazardId ? updated : h));
    } catch (err) {
      console.error("Failed to upvote hazard:", err);
    }
  };

  // Create hazard (BUG-05: now calls backend API)
  const handleCreateHazard = async (e) => {
    e.preventDefault();
    if (!hazardForm.route.trim() || !hazardForm.description.trim()) return;

    try {
      const res = await api.post("/community/hazards", {
        route: hazardForm.route,
        type: hazardForm.type,
        severity: hazardForm.severity,
        description: hazardForm.description
      });
      const newHazard = { ...res.data, id: res.data._id || res.data.id };
      setHazards(prev => [newHazard, ...prev]);
      setHazardForm({ route: "", type: "Potholes", severity: "medium", description: "" });
      alert("Road hazard broadcasted to emergency network!");
    } catch (err) {
      console.error("Failed to report hazard:", err);
    }
  };

  const sortedHazards = [...hazards].sort((a, b) => b.upvotes - a.upvotes);

  return (
    <div className="min-h-screen bg-[#0e1015] text-[#9ca3af] font-sans flex flex-col md:flex-row">
      
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
              <p className="text-[10px] text-gray-500 font-medium mt-1 whitespace-nowrap">Unified Patient Console</p>
            </div>
          </div>

          {/* User quick profile metadata card */}
          <div className="flex items-center gap-3 p-3 bg-[#1e2330]/50 rounded-2xl border border-gray-800/60">
            <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
              👤
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
              onClick={() => setActiveTab("map")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "map"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiMapPin className="w-4.5 h-4.5" />
              <span>Map & Dispatch</span>
              {activeEmergency && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "profile"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiUser className="w-4.5 h-4.5" />
              <span>Medical Profile</span>
            </button>

            <button
              onClick={() => setActiveTab("location")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "location"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiCompass className="w-4.5 h-4.5" />
              <span>Live Location</span>
            </button>
          </nav>
        </div>

        {/* Live Sidebar Map Section */}
        <div className="my-4 border border-gray-800/60 bg-[#1e2330]/45 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isGpsActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></span>
              Live GPS Radar
            </span>
            <span className="text-[8px] font-mono text-gray-500">
              {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </span>
          </div>
          <div className="h-28 w-full rounded-xl overflow-hidden relative border border-gray-800/80 z-0">
            {gpsError ? (
              <div className="absolute inset-0 bg-[#0e1015]/95 backdrop-blur-sm z-50 flex items-center justify-center p-2 text-center">
                <p className="text-[8px] text-red-400 font-bold leading-tight">GPS Access Blocked</p>
              </div>
            ) : (
              <MapContainer 
                center={[userLocation.lat, userLocation.lng]} 
                zoom={14} 
                zoomControl={false}
                dragging={false}
                doubleClickZoom={false}
                scrollWheelZoom={false}
                attributionControl={false}
                style={{ height: "100%", width: "100%", filter: "invert(90%) hue-rotate(180deg) brightness(85%) contrast(110%)" }}
                key="sidebar-map"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[userLocation.lat, userLocation.lng]} />
              </MapContainer>
            )}
          </div>
        </div>

        {/* Sidebar Docked Logout Area at the Bottom */}
        <div className="pt-6 border-t border-gray-800/80">
          <LogoutButton className="w-full justify-center" />
        </div>
      </aside>

      {/* ----------------------------------------------------
          2. RESPONSIVE HEADER BAR (Mobile/Tablet Viewport)
          ---------------------------------------------------- */}
      <header className="md:hidden border-b border-gray-800 bg-[#161a23]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <FiActivity className="w-5.5 h-5.5 text-red-500 animate-pulse" />
          <span className="text-md font-bold text-white tracking-tight leading-none block">SmartAmbulance</span>
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 text-gray-400 hover:text-white transition"
        >
          {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
        </button>

        {mobileMenuOpen && (
          <div className="absolute right-6 top-16 bg-[#161a23]/95 backdrop-blur-xl border border-gray-800/80 rounded-2xl p-4 w-52 shadow-2xl flex flex-col gap-2 z-50">
            <button
              onClick={() => { setActiveTab("community"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 transition ${
                activeTab === "community" ? "bg-red-500/10 text-red-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <FiUsers className="w-3.5 h-3.5" />
              <span>Community</span>
            </button>
            <button
              onClick={() => { setActiveTab("map"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 transition ${
                activeTab === "map" ? "bg-red-500/10 text-red-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <FiMapPin className="w-3.5 h-3.5" />
              <span>Map & Dispatch</span>
            </button>
            <button
              onClick={() => { setActiveTab("profile"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 transition ${
                activeTab === "profile" ? "bg-red-500/10 text-red-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <FiUser className="w-3.5 h-3.5" />
              <span>Medical Profile</span>
            </button>
            <button
              onClick={() => { setActiveTab("location"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 transition ${
                activeTab === "location" ? "bg-red-500/10 text-red-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <FiCompass className="w-3.5 h-3.5" />
              <span>Live Location</span>
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
            VIEWPORT A: MAP & DISPATCH VIEW
            ==================================================== */}
        {activeTab === "map" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">
            {/* Main dispatch/booking active screen viewport */}
            <div className="lg:col-span-2 order-first lg:order-none">
              {activeEmergency ? (
                <ActiveTripCard />
              ) : (
                <EmergencyForm />
              )}
            </div>

            {/* Sidebar quick metadata widgets (Patient overview) */}
            <div className="space-y-6 order-last lg:order-none">
              {/* Welcome card */}
              <div className="bg-gradient-to-br from-[#161a23] to-[#1a1f2c] border border-gray-800 p-6 rounded-2xl shadow-xl shadow-black/40">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400">
                  Rescue Command
                </span>
                <h2 className="text-xl font-bold text-white mt-3 mb-2">Hello, {user?.name || "Patient"}</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Welcome to the Smart Ambulance tracking portal. Here you can request emergency assistance in one click and track the dispatcher in real-time.
                </p>
              </div>

              {/* Quick instructions guide */}
              <div className="bg-[#161a23] border border-gray-800 p-6 rounded-2xl shadow-xl">
                <h3 className="text-white font-bold text-xs mb-4 tracking-wider uppercase">Emergency Protocol</h3>
                <ul className="space-y-4">
                  <li className="flex gap-3 text-xs leading-relaxed">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold font-mono">1</div>
                    <div>
                      <h4 className="text-white font-semibold mb-0.5">Select Emergency Type</h4>
                      <p className="text-[10px] text-gray-500">Choose the nature of the situation and provide description notes.</p>
                    </div>
                  </li>
                  <li className="flex gap-3 text-xs leading-relaxed">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold font-mono">2</div>
                    <div>
                      <h4 className="text-white font-semibold mb-0.5">Grant Location Access</h4>
                      <p className="text-[10px] text-gray-500">Ensure Geolocation is enabled to auto-pin your GPS coordinates.</p>
                    </div>
                  </li>
                  <li className="flex gap-3 text-xs leading-relaxed">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold font-mono">3</div>
                    <div>
                      <h4 className="text-white font-semibold mb-0.5">Track Dispatcher Live</h4>
                      <p className="text-[10px] text-gray-500">Watch the route details, distance updates, and live ETA on the map.</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Emergency Hotline Card */}
              <div className="bg-[#161a23] border border-gray-800 p-6 rounded-2xl shadow-xl flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-white font-bold text-xs tracking-wide">Emergency Hotline</h4>
                  <p className="text-[10px] text-gray-500">Direct voice support</p>
                </div>
                <a 
                  href="tel:102"
                  className="flex items-center justify-center w-11 h-11 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition duration-200"
                >
                  <FiPhoneCall className="w-4.5 h-4.5" />
                </a>
            </div>
          </div>
        </div>
      )}

        {/* ====================================================
            VIEWPORT B: EMBEDDED COMMUNITY TABS (Unified Layout)
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
                <p className="text-xs text-gray-500 mt-0.5">Connect, share route updates, and warning bulletins.</p>
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
                        placeholder={`What's happening on the routes, ${user?.name}?`}
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
            VIEWPORT C: COMPREHENSIVE MEDICAL PROFILE VIEW
            ==================================================== */}
        {activeTab === "profile" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            
            {/* Header info badge */}
            <div className="bg-[#161a23] border border-gray-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-3xl shadow">
                🏥
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{user?.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Secure Emergency Clinical Health Ledger ID: #{user?.id?.substring(0, 10).toUpperCase()}</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold uppercase rounded-md">
                    Clinical Clearance
                  </span>
                  <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[8px] font-bold uppercase rounded-md animate-pulse">
                    GPS Synced
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Detail Cards */}
            <div className="bg-[#161a23] border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 border border-dashed border-red-500/10 rounded-full translate-x-8 -translate-y-8 select-none"></div>

              <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-6">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <FiFileText className="text-red-500" />
                  <span>Personal Emergency Record</span>
                </h3>
                
                {!isEditingProfile ? (
                  <button
                    onClick={() => { setTempProfile({ ...profileData }); setIsEditingProfile(true); }}
                    className="py-1 px-3.5 bg-[#1e2330] hover:bg-[#252b3a] border border-gray-800 text-white font-bold rounded-xl text-[10px] uppercase transition cursor-pointer"
                  >
                    Edit Records
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="py-1 px-3.5 bg-transparent border border-gray-800 text-gray-400 hover:text-white font-bold rounded-xl text-[10px] uppercase transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {!isEditingProfile ? (
                /* Static view mode */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Blood Group</span>
                    <span className="text-sm font-black text-red-500">{profileData.bloodGroup}</span>
                  </div>

                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Insurance Policy ID</span>
                    <span className="text-sm font-black text-white">{profileData.insuranceId}</span>
                  </div>

                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl md:col-span-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Pre-existing Medical Issues</span>
                    <p className="text-xs font-bold text-gray-300">{profileData.conditions}</p>
                  </div>

                  <div className="border border-gray-800/80 p-4 bg-[#1e2330]/20 rounded-2xl md:col-span-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Known Drug Allergies</span>
                    <p className="text-xs font-bold text-red-400/90">{profileData.allergies}</p>
                  </div>

                  <div className="border border-blue-900/40 p-4 bg-blue-950/10 rounded-2xl md:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-blue-400/80 uppercase tracking-widest font-bold block mb-1">Emergency SOS Contact (Family Broadcast)</span>
                      <p className="text-xs font-black text-blue-100">{profileData.emergencyContactName}</p>
                      <p className="text-sm font-black text-blue-300 mt-0.5">{profileData.emergencyContactPhone}</p>
                    </div>
                    <span className="text-2xl animate-pulse">❤️</span>
                  </div>
                </div>
              ) : (
                /* Editable form mode */
                <form onSubmit={handleSaveProfile} className="space-y-4 font-mono text-[10px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">Blood Group</label>
                      <input
                        type="text"
                        value={tempProfile.bloodGroup}
                        onChange={(e) => setTempProfile({ ...tempProfile, bloodGroup: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">Insurance ID</label>
                      <input
                        type="text"
                        value={tempProfile.insuranceId}
                        onChange={(e) => setTempProfile({ ...tempProfile, insuranceId: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">Medical Conditions</label>
                      <input
                        type="text"
                        value={tempProfile.conditions}
                        onChange={(e) => setTempProfile({ ...tempProfile, conditions: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">Drug Allergies</label>
                      <input
                        type="text"
                        value={tempProfile.allergies}
                        onChange={(e) => setTempProfile({ ...tempProfile, allergies: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">SOS Contact Name</label>
                      <input
                        type="text"
                        value={tempProfile.emergencyContactName}
                        onChange={(e) => setTempProfile({ ...tempProfile, emergencyContactName: e.target.value })}
                        required
                        className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-red-500 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 uppercase tracking-wider mb-1">SOS Contact Phone</label>
                      <input
                        type="text"
                        value={tempProfile.emergencyContactPhone}
                        onChange={(e) => setTempProfile({ ...tempProfile, emergencyContactPhone: e.target.value })}
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
                      Save & Sync Record
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Safety Information Box */}
            <div className="bg-gradient-to-br from-[#161a23] to-[#1a1f2c] border border-gray-800 p-5 rounded-3xl flex gap-3 text-xs leading-relaxed">
              <FiInfo className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="font-bold text-white uppercase tracking-wider">Integrity of Emergency Vitals Ledger</h4>
                <p className="text-gray-500 mt-1">
                  The clinical metadata filled out here is automatically package-bundled and routed directly to the claiming ambulance paramedic units and prepared hospital trauma wards immediately upon trigger of your SOS booking. Keep this data accurate to secure optimized medical triage readiness.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ====================================================
            VIEWPORT D: LIVE GPS RADAR MAP VIEW
            ==================================================== */}
        {activeTab === "location" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Title & Info Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161a23] border border-gray-800 p-6 rounded-3xl shadow-xl">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400">
                  Global GPS Tracker
                </span>
                <h2 className="text-xl font-bold text-white mt-3 mb-1">My Live Coordinates Radar</h2>
                <p className="text-xs text-gray-400">Your physical location is being continuously monitored and pinned in real-time below.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isGpsActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  {isGpsActive ? "GPS Active & Pinned" : "GPS Signal Searching..."}
                </span>
              </div>
            </div>

            {/* Geolocation Telemetry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#161a23] border border-gray-800 p-4 rounded-2xl shadow-md">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-semibold">Latitude</p>
                <p className="text-lg font-bold text-white font-mono mt-1">{userLocation.lat.toFixed(6)}</p>
              </div>
              <div className="bg-[#161a23] border border-gray-800 p-4 rounded-2xl shadow-md">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-semibold">Longitude</p>
                <p className="text-lg font-bold text-white font-mono mt-1">{userLocation.lng.toFixed(6)}</p>
              </div>
              <div className="bg-[#161a23] border border-gray-800 p-4 rounded-2xl shadow-md">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono font-semibold">Signal Precision</p>
                <p className="text-lg font-bold text-white font-mono mt-1">
                  {gpsAccuracy ? `±${gpsAccuracy.toFixed(1)} meters` : "Calibrating..."}
                </p>
              </div>
            </div>

            {/* Live Leaflet Map Container */}
            <div className="rounded-3xl overflow-hidden border border-gray-800 h-[40vh] sm:h-[50vh] md:h-[500px] relative z-0 shadow-2xl">
              {gpsError && (
                <div className="absolute inset-0 bg-[#0e1015]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
                  <FiAlertTriangle className="w-12 h-12 text-yellow-500 mb-4 animate-bounce" />
                  <h4 className="text-white font-bold text-lg mb-2">Location Access Blocked</h4>
                  <p className="text-xs text-gray-400 max-w-sm">
                    {gpsError}. Please ensure location permissions are enabled in your browser settings to utilize the live radar tracker.
                  </p>
                </div>
              )}
              
              <MapContainer 
                center={[userLocation.lat, userLocation.lng]} 
                zoom={15} 
                style={{ height: "100%", width: "100%" }}
                key="location-map" // Static key prevents map destruction on GPS updates (BUG-11)
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {/* User live coordinate node */}
                <Marker position={[userLocation.lat, userLocation.lng]}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-red-500">Your Current Location</p>
                      <p className="text-gray-600 font-mono font-semibold">Lat: {userLocation.lat.toFixed(5)}</p>
                      <p className="text-gray-600 font-mono font-semibold">Lng: {userLocation.lng.toFixed(5)}</p>
                      <p className="text-gray-500">Live Pinned & Active</p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default PatientDashboard;