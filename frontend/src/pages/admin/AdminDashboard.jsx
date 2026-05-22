import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api.js";
import socket from "../../socket/socket.js";
import LogoutButton from "../../components/LogoutButton.jsx";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { FiActivity, FiUsers, FiMapPin, FiDatabase, FiGrid } from "react-icons/fi";

function AdminDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get("/emergency/all");
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error("Error fetching emergency requests for admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

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

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (filterType === "all") return true;
    return req.status === filterType;
  });

  // Calculate statistics
  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === "pending").length;
  const activeCount = requests.filter(r => r.status === "accepted" || r.status === "on_the_way" || r.status === "arrived").length;
  const completedCount = requests.filter(r => r.status === "completed").length;

  const stats = [
    { label: "Total Emergencies", value: totalCount, icon: <FiDatabase className="w-5 h-5 text-blue-400" />, color: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
    { label: "Pending Claims", value: pendingCount, icon: <FiActivity className="w-5 h-5 text-yellow-400" />, color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" },
    { label: "Active Rescues", value: activeCount, icon: <FiMapPin className="w-5 h-5 text-red-400" />, color: "bg-red-500/10 border-red-500/20 text-red-400" },
    { label: "Completed Trips", value: completedCount, icon: <FiUsers className="w-5 h-5 text-green-400" />, color: "bg-green-500/10 border-green-500/20 text-green-400" },
  ];

  return (
    <div className="min-h-screen bg-[#0e1015] text-[#9ca3af] font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#161a23]/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500 shadow-lg">
              <FiActivity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-bold text-white tracking-tight block">Admin Command Center</span>
              <p className="text-xs text-gray-500">System Monitoring & Dispatch Audit</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/community"
              className="px-3.5 py-1.5 bg-[#1e2330] hover:bg-[#252b3a] border border-gray-800 hover:border-gray-700 text-white font-bold rounded-xl text-xs transition duration-200 shadow-sm uppercase tracking-wider"
            >
              Community Hub
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-[#161a23] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{stat.label}</span>
                <div className={`p-2 rounded-xl border ${stat.color}`}>{stat.icon}</div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-white tracking-tight">{stat.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Live Grid Map and Request list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Active map panel */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FiMapPin />
              Real-time Incident Radar
            </h2>
            <div className="rounded-3xl overflow-hidden border border-gray-800 h-[450px] relative z-0 shadow-xl">
              <MapContainer center={[25.591, 85.1376]} zoom={11} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {/* Pins for active emergencies */}
                {requests
                  .filter(r => r.status !== "completed" && r.status !== "cancelled")
                  .map((req) => {
                    const lat = req.pickupLocation?.coordinates[1];
                    const lng = req.pickupLocation?.coordinates[0];
                    if (!lat || !lng) return null;

                    return (
                      <Marker key={req._id} position={[lat, lng]}>
                        <Popup>
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-red-500 capitalize">{req.emergencyType.replace("_", " ")}</p>
                            <p className="text-gray-600">Patient: {req.patientId?.name || "Unknown"}</p>
                            <p className="text-gray-500 uppercase font-semibold">Status: {req.status}</p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
              </MapContainer>
            </div>
          </div>

          {/* Audit Logs Filter Sidebar */}
          <div className="bg-[#161a23] border border-gray-800 p-6 rounded-2xl shadow-xl space-y-6 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-white font-bold text-sm tracking-wider uppercase flex items-center gap-2">
                <FiGrid />
                Filter Console
              </h3>
              <p className="text-xs text-gray-500">Filter incident logs by active or finalized transit states.</p>
              
              <div className="space-y-2">
                {["all", "pending", "accepted", "on_the_way", "arrived", "completed", "cancelled"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`w-full py-2 px-4 text-xs font-semibold rounded-xl text-left border transition capitalize cursor-pointer flex justify-between items-center ${
                      filterType === type
                        ? "bg-red-500/10 border-red-500/25 text-red-400 font-bold"
                        : "bg-[#1e2330]/40 border-gray-800 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <span>{type.replace("_", " ")}</span>
                    <span className="bg-[#1e2330] px-1.5 py-0.5 rounded text-[10px] text-gray-500 font-bold">
                      {type === "all" ? requests.length : requests.filter(r => r.status === type).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={fetchRequests}
              className="w-full py-3 bg-[#1e2330] hover:bg-gray-800 text-white border border-gray-800 hover:border-gray-700 font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Refresh Dispatch Registry
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-[#161a23] border border-gray-800 p-6 rounded-2xl shadow-xl space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <h2 className="text-lg font-bold text-white">System Rescue Incident Logs</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Incident Code</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Assigned Paramedic</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 text-xs">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">No matching incident logs discovered.</td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-[#1e2330]/20 transition">
                      <td className="py-4 px-4 font-mono font-bold text-gray-400">
                        #{req._id.substring(req._id.length - 8).toUpperCase()}
                      </td>
                      <td className="py-4 px-4 font-bold text-white capitalize">{req.emergencyType.replace("_", " ")}</td>
                      <td className="py-4 px-4">{req.patientId?.name || "Anonymous"}</td>
                      <td className="py-4 px-4 text-green-400 font-semibold">{req.driverId?.name || req.assignedDriver?.name || "Waiting Claim"}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                          req.status === "pending" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                          req.status === "completed" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                          req.status === "cancelled" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                          "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        }`}>
                          {req.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-500">{new Date(req.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

export default AdminDashboard;