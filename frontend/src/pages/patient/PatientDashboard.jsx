import { useState, useEffect, useRef } from "react";
import { Link } from 'react-router-dom';
import LogoutButton from '../../components/LogoutButton.jsx';
import EmergencyForm from "./EmergencyForm.jsx";
import ActiveTripCard from "./ActiveTripCard.jsx";
import { useEmergency } from "../../context/EmergencyContext";
import { useAuth } from "../../context/AuthContext";
import socket from "../../socket/socket.js";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { 
  FiActivity, FiUser, FiMapPin, FiPhoneCall, FiUsers, 
  FiAlertTriangle, FiX, FiInfo, FiClock, FiSettings,
  FiFileText, FiChevronRight, FiCheckCircle, FiCompass, FiMenu
} from "react-icons/fi";
import CommunityHub from "../../components/community/CommunityHub";


function PatientDashboard() {
  const { activeEmergency } = useEmergency();
  const { user } = useAuth();
  
  // NAVIGATION ACTIVE TAB
  const [activeTab, setActiveTab] = useState("community"); // "community", "map", "profile", "location"
  
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
  }, []);

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
                key={`sidebar-${userLocation.lat}-${userLocation.lng}`}
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
          <CommunityHub isDashboard={true} />
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
                key={`${userLocation.lat}-${userLocation.lng}`} // Forces map re-center when GPS resolves initially
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