import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import socket from "../../socket/socket.js";
import Radar from "radar-sdk-js";
import { useAuth } from "../../context/AuthContext";
import { useEmergency } from "../../context/EmergencyContext";
import api from "../../services/api.js";
import LogoutButton from "../../components/LogoutButton.jsx";
import DriverStats from "./DriverStats.jsx";
import IncomingRequest from "./IncomingRequest.jsx";
import ActiveTrip from "./ActiveTrip.jsx";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { 
  FiActivity, FiUser, FiWifi, FiWifiOff, FiAlertCircle, FiClock,
  FiUsers, FiAlertTriangle, FiThumbsUp, FiMessageCircle, FiSend, 
  FiImage, FiX, FiCheck, FiUserPlus, FiInfo, FiSettings, FiFileText, 
  FiChevronRight, FiMapPin, FiTruck, FiMenu
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

function DriverDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { acceptEmergency, updateEmergencyStatus } = useEmergency();

  // NAVIGATION TABS
  const [activeTab, setActiveTab] = useState("cockpit"); // "community", "cockpit", "stats"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // DRIVER STATUS & TRIP STATE
  const [isOnline, setIsOnline] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [incomingRequestAlert, setIncomingRequestAlert] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [patientLiveLocation, setPatientLiveLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const watchIdRef = useRef(null);

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

  // Fetch initial driver requests and pending pool
  useEffect(() => {
    const initDashboard = async () => {
      try {
        setLoading(true);
        const tripRes = await api.get("/emergency/my-requests");
        const myTrips = tripRes.data.requests || [];
        const active = myTrips.find(t => t.status !== "completed" && t.status !== "cancelled");
        
        if (active) {
          setActiveTrip(active);
          setIsOnline(true); // Automatically toggle online if on an active mission
        } else {
          const pendingRes = await api.get("/emergency/pending");
          setPendingRequests(pendingRes.data.requests || []);
        }
      } catch (err) {
        console.error("Error initializing driver cockpit:", err);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []);

  // Set identity when user changes
  useEffect(() => {
    if (user) {
      Radar.setUserId(user.id || user._id);
      Radar.setMetadata({
        name: user.name,
        email: user.email,
        role: user.role
      });
    }
  }, [user]);

  // Sync online GPS tracking and Socket emissions
  useEffect(() => {
    if (isOnline) {
      // Initial trackOnce
      Radar.trackOnce()
        .then((result) => {
          if (result && result.location) {
            const locData = {
              lat: result.location.latitude,
              lng: result.location.longitude,
              driverId: user?.id
            };
            setDriverLocation({ lat: locData.lat, lng: locData.lng });
            socket.emit("driverLocationUpdate", locData);
          }
        })
        .catch((err) => console.warn("Initial Driver Radar track failed:", err));

      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const locData = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              driverId: user?.id
            };
            setDriverLocation({ lat: locData.lat, lng: locData.lng });
            
            // Emit to backend socket using corrected event name
            socket.emit("driverLocationUpdate", locData);
            console.log("GPS Location Emitted via WebSockets:", locData);

            // Sync with Radar in the background
            Radar.trackOnce()
              .then((result) => {
                if (result && result.location) {
                  console.log("Driver Radar position synced:", result.location);
                }
              })
              .catch((err) => console.warn("Driver Radar sync failed:", err));
          },
          (err) => console.error("GPS Watch error:", err),
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      } else {
        alert("Geolocation is not supported by your browser.");
      }
    } else {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setDriverLocation(null);
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isOnline, user?.id]);

  // Real-time Socket Event Listeners
  useEffect(() => {
    socket.on("emergencyRequest", (newRequest) => {
      console.log("Real-time emergency broadcast received:", newRequest);
      setPendingRequests(prev => [newRequest, ...prev]);

      if (isOnline && !activeTrip) {
        setIncomingRequestAlert(newRequest);
      }
    });

    socket.on("emergencyStatusUpdated", (updatedRequest) => {
      setPendingRequests(prev => prev.filter(r => r._id !== updatedRequest._id));
      
      if (activeTrip && activeTrip._id === updatedRequest._id) {
        if (updatedRequest.status === "completed" || updatedRequest.status === "cancelled") {
          setActiveTrip(null);
          alert(`Rescue mission ${updatedRequest.status}! Dashboard reset.`);
        } else {
          setActiveTrip(updatedRequest);
        }
      }
    });

    socket.on("emergencyAccepted", (updatedRequest) => {
      setPendingRequests(prev => prev.filter(r => r._id !== updatedRequest._id));
      if (incomingRequestAlert && incomingRequestAlert._id === updatedRequest._id) {
        setIncomingRequestAlert(null);
      }
    });

    socket.on("patientLocationUpdated", (locationData) => {
      console.log("Patient live location updated received:", locationData);
      if (activeTrip && locationData.emergencyId === activeTrip._id) {
        setPatientLiveLocation({
          lat: locationData.lat,
          lng: locationData.lng
        });
      }
    });

    return () => {
      socket.off("emergencyRequest");
      socket.off("emergencyStatusUpdated");
      socket.off("emergencyAccepted");
      socket.off("patientLocationUpdated");
    };
  }, [isOnline, activeTrip, incomingRequestAlert]);

  // Clear patient live location when active trip ends
  useEffect(() => {
    if (!activeTrip) {
      setPatientLiveLocation(null);
    }
  }, [activeTrip]);

  // Action: Accept mission
  const handleAcceptMission = async (requestId) => {
    setLoading(true);
    try {
      const res = await acceptEmergency(requestId);
      const tripObj = res.request || res;
      setActiveTrip(tripObj);
      setIncomingRequestAlert(null);
      setPendingRequests(prev => prev.filter(r => r._id !== requestId));
      alert("Emergency rescue mission successfully accepted!");
    } catch (err) {
      console.error(err);
      alert("Failed to accept mission. It may have been claimed by another unit.");
    } finally {
      setLoading(false);
    }
  };

  // Action: Update trip status
  const handleUpdateTripStatus = async (tripId, nextStatus) => {
    setLoading(true);
    try {
      const res = await updateEmergencyStatus(tripId, nextStatus);
      const tripObj = res.request || res;
      
      if (nextStatus === "completed" || nextStatus === "cancelled") {
        setActiveTrip(null);
        alert(`Mission marked as ${nextStatus}!`);
        const pendingRes = await api.get("/emergency/pending");
        setPendingRequests(pendingRes.data.requests || []);
      } else {
        setActiveTrip(tripObj);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0e1015] flex flex-col items-center justify-center text-center p-4">
        <div className="bg-[#161a23]/60 border border-gray-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col items-center max-w-sm">
          <span className="text-[10px] font-mono tracking-widest text-red-500 uppercase animate-pulse">
            📡 Synchronizing Security Console...
          </span>
          <p className="text-xs text-gray-500 mt-2 font-medium">Verifying paramedic telemetry channels...</p>
        </div>
      </div>
    );
  }

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
              <p className="text-[10px] text-gray-500 font-medium mt-1 whitespace-nowrap">Unified Paramedic Console</p>
            </div>
          </div>

          {/* User quick profile metadata card */}
          <div className="flex items-center gap-3 p-3 bg-[#1e2330]/50 rounded-2xl border border-gray-800/60">
            <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
              🚑
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
              onClick={() => setActiveTab("cockpit")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "cockpit"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiWifi className="w-4.5 h-4.5" />
              <span>Rescue Cockpit</span>
              {activeTrip && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("stats")}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition flex items-center gap-3 uppercase cursor-pointer text-left ${
                activeTab === "stats"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold"
                  : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-[#1e2330]/40"
              }`}
            >
              <FiActivity className="w-4.5 h-4.5" />
              <span>Transit Stats</span>
            </button>
          </nav>
        </div>

        {/* Live Sidebar Map Section */}
        <div className="my-4 border border-gray-800/60 bg-[#1e2330]/45 rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500 animate-pulse"}`}></span>
              Live GPS Radar
            </span>
            <span className="text-[8px] font-mono text-gray-500">
              {driverLocation ? `${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}` : "OFFLINE"}
            </span>
          </div>
          <div className="h-28 w-full rounded-xl overflow-hidden relative border border-gray-800/80 z-0">
            {!isOnline ? (
              <div className="absolute inset-0 bg-[#0e1015]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-2 text-center">
                <FiWifiOff className="w-5 h-5 text-red-500 mb-1 animate-pulse" />
                <p className="text-[9px] text-red-400 font-bold leading-tight uppercase">Radar Offline</p>
                <p className="text-[7px] text-gray-500 mt-0.5 font-semibold">Toggle online in cockpit to broadcast live location</p>
              </div>
            ) : !driverLocation ? (
              <div className="absolute inset-0 bg-[#0e1015]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-2 text-center">
                <span className="text-[9px] text-yellow-500 font-bold leading-tight animate-bounce">📡 Calibrating GPS...</span>
              </div>
            ) : (
              <MapContainer 
                center={[driverLocation.lat, driverLocation.lng]} 
                zoom={14} 
                zoomControl={false}
                dragging={false}
                doubleClickZoom={false}
                scrollWheelZoom={false}
                attributionControl={false}
                style={{ height: "100%", width: "100%", filter: "invert(90%) hue-rotate(180deg) brightness(85%) contrast(110%)" }}
                key={`sidebar-driver-${driverLocation.lat}-${driverLocation.lng}`}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[driverLocation.lat, driverLocation.lng]} />
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
      <header className="md:hidden border-b border-gray-800 bg-[#161a23]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center w-full flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <FiActivity className="w-5.5 h-5.5 text-red-500 animate-pulse" />
          <span className="text-md font-bold text-white tracking-tight leading-none whitespace-nowrap block">SmartAmbulance</span>
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
              onClick={() => { setActiveTab("cockpit"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 transition ${
                activeTab === "cockpit" ? "bg-red-500/10 text-red-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <FiWifi className="w-3.5 h-3.5" />
              <span>Cockpit</span>
            </button>
            <button
              onClick={() => { setActiveTab("stats"); setMobileMenuOpen(false); }}
              className={`py-2 px-3 rounded-lg text-left text-xs font-semibold uppercase flex items-center gap-2 transition ${
                activeTab === "stats" ? "bg-red-500/10 text-red-400 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              <FiActivity className="w-3.5 h-3.5" />
              <span>Transit Stats</span>
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
                        placeholder={`What's happening on the routes, Paramedic ${user?.name}?`}
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
            VIEWPORT B: DRIVER COCKPIT & DISPATCH PANEL
            ==================================================== */}
        {activeTab === "cockpit" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Control Row with Online Toggle */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#161a23]/60 p-5 border border-gray-800 rounded-3xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiWifi className={isOnline ? "text-green-400 animate-pulse" : "text-gray-500"} />
                  <span>Rescue Control Cockpit</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Toggle online state to broadcast GPS and accept emergency missions.</p>
              </div>

              <button
                onClick={() => {
                  if (activeTrip) {
                    alert("Cannot go offline while on an active rescue mission!");
                    return;
                  }
                  setIsOnline(!isOnline);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 border rounded-2xl font-bold text-xs transition duration-200 cursor-pointer shadow-md ${
                  isOnline
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-gray-500/10 border-gray-800 text-gray-500 hover:border-gray-700"
                }`}
              >
                {isOnline ? (
                  <>
                    <FiWifi className="w-4.5 h-4.5 animate-bounce" />
                    <span>ONLINE / WATCHING GPS</span>
                  </>
                ) : (
                  <>
                    <FiWifiOff className="w-4.5 h-4.5" />
                    <span>OFFLINE / IDLE</span>
                  </>
                )}
              </button>
            </div>

            {/* Main Action Workspaces */}
            {activeTrip ? (
              <ActiveTrip
                trip={activeTrip}
                onUpdateStatus={handleUpdateTripStatus}
                loading={loading}
                driverLocation={driverLocation}
                patientLiveLocation={patientLiveLocation}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Pending Emergency Requests Incident Pool */}
                <div className="lg:col-span-2 bg-[#161a23] border border-gray-800 p-6 rounded-2xl shadow-xl space-y-6 order-first lg:order-none">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pending Incident Dispatch Pool</h2>
                    <span className="px-2.5 py-0.5 bg-[#1e2330] border border-gray-800 rounded-lg text-[10px] font-bold text-gray-400">
                      {pendingRequests.length} Incident(s)
                    </span>
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                      <FiClock className="w-12 h-12 mb-3 text-gray-700 animate-spin" />
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">No pending incidents active in dispatch.</p>
                      <p className="text-[10px] text-gray-700 mt-1">Enjoy down time. Websockets are listening live for emergency alerts.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {pendingRequests.map((req) => (
                        <div key={req._id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white capitalize flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                              {req.emergencyType.replace("_", " ")}
                            </h4>
                            <p className="text-[10px] text-gray-500">
                              Incident logged: {new Date(req.createdAt).toLocaleTimeString()} • Patient: {req.patientId?.name || "Anonymous"}
                            </p>
                            {req.patientNotes && (
                              <p className="text-[10px] italic text-gray-400">"{req.patientNotes}"</p>
                            )}
                          </div>
                          
                          <button
                            onClick={() => {
                              if (!isOnline) {
                                alert("You must toggle your status to ONLINE before claiming emergency missions!");
                                return;
                              }
                              handleAcceptMission(req._id);
                            }}
                            className="py-2 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-xs transition duration-200 cursor-pointer shadow-md uppercase tracking-wider"
                          >
                            Claim Rescue
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Geolocation Status Widget */}
                <div className="lg:col-span-1 space-y-6 order-last lg:order-none">
                  <div className="bg-[#161a23] border border-gray-800 p-6 rounded-2xl shadow-xl space-y-4">
                    <h3 className="text-white font-bold text-xs tracking-wider uppercase">Paramedic Status</h3>
                    
                    {isOnline ? (
                      <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs flex gap-3">
                        <FiWifi className="w-5 h-5 flex-shrink-0 animate-bounce text-green-400" />
                        <div>
                          <h4 className="font-bold">GPS Transmitter Active</h4>
                          <p className="text-gray-500 mt-1.5 leading-relaxed">
                            Your ambulance coordinates are broadcasting live. You will receive critical emergency alerts instantly.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl text-xs flex gap-3">
                        <FiWifiOff className="w-5 h-5 flex-shrink-0 text-yellow-500" />
                        <div>
                          <h4 className="font-bold">Transmitter Offline</h4>
                          <p className="text-gray-500 mt-1.5 leading-relaxed">
                            Toggle your status to ONLINE to synchronize geolocation coordinates and claim incoming emergency missions.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ====================================================
            VIEWPORT C: TRANSIT METRICS & STATS
            ==================================================== */}
        {activeTab === "stats" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Description */}
            <div className="bg-[#161a23]/60 p-5 border border-gray-800 rounded-3xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FiActivity className="text-red-500" />
                <span>Transit Analytics & Accomplishments</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Track your overall rescue ratios, rating averages, and active duty achievements.</p>
            </div>

            {/* Metrics Grids */}
            <DriverStats />

            {/* Safety Guidelines */}
            <div className="bg-[#161a23] border border-gray-800 p-6 rounded-2xl shadow-xl flex gap-3 text-xs leading-relaxed">
              <FiInfo className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="font-bold text-white uppercase tracking-wider">Paramedic Protocol & Compliance</h4>
                <p className="text-gray-500 mt-1 leading-relaxed">
                  Always ensure that you toggle your online transmitter to ONLINE only when active on duty and in the vehicle. In case of route hazards or obstructions, broadcast route hazard alerts in the Community Hub so that other units are routed appropriately. Keep tracking active until the patient is completely safely delivered to the standby hospital trauma ward.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Floating Incoming Incident Callout Card */}
      {incomingRequestAlert && (
        <IncomingRequest
          request={incomingRequestAlert}
          onAccept={handleAcceptMission}
          loading={loading}
        />
      )}
    </div>
  );
}

export default DriverDashboard;