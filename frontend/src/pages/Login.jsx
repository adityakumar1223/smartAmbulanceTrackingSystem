import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiMail, FiLock, FiActivity, FiXCircle, FiLoader, FiMapPin, FiTruck } from "react-icons/fi";
import socket from "../socket/socket.js";
import api from "../services/api.js";
import MapComponent from "../components/map/MapComponent.jsx";
import Radar from "radar-sdk-js";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // SOS tracking states
  const [activeSOS, setActiveSOS] = useState(() => {
    const saved = localStorage.getItem("anonymous_sos_request");
    return saved ? JSON.parse(saved) : null;
  });
  const [driverLocation, setDriverLocation] = useState(null);
  const [sosLoading, setSosLoading] = useState(false);

  // Socket listener for SOS updates
  useEffect(() => {
    if (!activeSOS) {
      setDriverLocation(null);
      return;
    }

    const handleStatusUpdate = (updatedRequest) => {
      if (updatedRequest._id === activeSOS._id) {
        if (updatedRequest.status === "completed" || updatedRequest.status === "cancelled") {
          setActiveSOS(null);
          localStorage.removeItem("anonymous_sos_request");
          setDriverLocation(null);
          alert(`Your SOS rescue mission was marked as ${updatedRequest.status}.`);
        } else {
          setActiveSOS(updatedRequest);
          localStorage.setItem("anonymous_sos_request", JSON.stringify(updatedRequest));
        }
      }
    };

    const handleDriverLocation = (locationData) => {
      // Check if location data matches assigned driver
      const assignedDriverId = activeSOS.driverId?._id || activeSOS.driverId;
      if (assignedDriverId && locationData.driverId === assignedDriverId) {
        setDriverLocation({
          lat: locationData.lat,
          lng: locationData.lng
        });
      }
    };

    socket.on("emergencyStatusUpdated", handleStatusUpdate);
    socket.on("driverLocationUpdated", handleDriverLocation);

    return () => {
      socket.off("emergencyStatusUpdated", handleStatusUpdate);
      socket.off("driverLocationUpdated", handleDriverLocation);
    };
  }, [activeSOS]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const user = await login(formData.email, formData.password);
      
      // Redirect based on role
      if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "patient") {
        navigate("/patient", { replace: true });
      } else if (user.role === "driver") {
        navigate("/driver", { replace: true });
      } else if (user.role === "hospital") {
        navigate("/hospital", { replace: true });
      }
    } catch (error) {
      console.error(error);
      setErrorMsg(error.response?.data?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSOSClick = async () => {
    setSosLoading(true);

    const handleSuccess = async (lat, lng) => {
      try {
        const pickupLocation = {
          type: "Point",
          coordinates: [lng, lat]
        };

        const response = await api.post("/emergency/sos", { pickupLocation });
        const request = response.data.request;
        
        setActiveSOS(request);
        localStorage.setItem("anonymous_sos_request", JSON.stringify(request));
        alert("SOS Dispatch Triggered! Nearby ambulances are being notified.");
      } catch (error) {
        console.error("Failed to trigger SOS:", error);
        alert(error.response?.data?.message || "Failed to trigger SOS. Please try again or call emergency services.");
      } finally {
        setSosLoading(false);
      }
    };

    const handleFallback = () => {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        setSosLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleSuccess(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Please enable location permissions to dispatch an ambulance to your location.");
          setSosLoading(false);
        },
        { enableHighAccuracy: true }
      );
    };

    try {
      // Configure Anonymous SOS user metadata in Radar
      Radar.setUserId("anonymous_sos_" + Date.now());
      Radar.setMetadata({ role: "patient", type: "anonymous_sos" });

      Radar.trackOnce()
        .then((result) => {
          if (result && result.location) {
            handleSuccess(result.location.latitude, result.location.longitude);
          } else {
            handleFallback();
          }
        })
        .catch((err) => {
          console.warn("Radar SOS tracking failed, falling back to native Geolocation:", err);
          handleFallback();
        });
    } catch (err) {
      console.error("SOS tracking error:", err);
      handleFallback();
    }
  };

  const handleCancelSOS = async () => {
    if (!activeSOS) return;
    if (window.confirm("Are you sure you want to cancel your SOS emergency request?")) {
      try {
        setSosLoading(true);
        await api.put(`/emergency/sos/cancel/${activeSOS._id}`);
        setActiveSOS(null);
        localStorage.removeItem("anonymous_sos_request");
        setDriverLocation(null);
        alert("SOS request has been successfully cancelled.");
      } catch (error) {
        console.error("Failed to cancel SOS:", error);
        alert("Failed to cancel SOS request. Please try again.");
      } finally {
        setSosLoading(false);
      }
    }
  };

  const getStepIndex = (status) => {
    switch (status) {
      case "pending":
        return 0;
      case "accepted":
        return 1;
      case "on_the_way":
        return 2;
      case "arrived":
        return 3;
      case "completed":
        return 4;
      default:
        return 0;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0e1015] px-4 font-sans">
      <div className={`bg-[#161a23]/80 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl w-full shadow-2xl shadow-black/50 transition-all duration-500 ${activeSOS ? "max-w-2xl" : "max-w-md"}`}>
        
        {activeSOS ? (
          // Active SOS Tracking View
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="text-center pb-4 border-b border-gray-800">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse mb-3">
                <FiTruck className="w-3.5 h-3.5 animate-bounce" />
                <span>Active SOS Dispatch</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Emergency Assistance Active</h2>
              <p className="text-xs text-gray-500 mt-1 font-mono">SOS Request ID: {activeSOS._id.substring(activeSOS._id.length - 8).toUpperCase()}</p>
            </div>

            {/* Waiting Status Alert Banner */}
            {activeSOS.status === "pending" && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-2xl flex items-center justify-center gap-3 text-xs animate-pulse">
                <FiLoader className="w-4.5 h-4.5 animate-spin flex-shrink-0" />
                <div className="font-semibold uppercase tracking-wider">
                  Waiting for request to get accepted.
                </div>
              </div>
            )}

            {/* Stepper Timeline */}
            <div className="grid grid-cols-5 gap-1 relative text-center">
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-gray-800 -z-10" />
              {[
                { label: "SOS Sent", desc: "Pending" },
                { label: "Claimed", desc: "Assigned" },
                { label: "En Route", desc: "On the way" },
                { label: "Arrived", desc: "On site" },
                { label: "Done", desc: "Complete" }
              ].map((step, idx) => {
                const currentStep = getStepIndex(activeSOS.status);
                const isActive = idx <= currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div key={idx} className="flex flex-col items-center z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-bold text-xs transition-all duration-300 ${
                      isCurrent ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30 scale-110" :
                      isActive ? "bg-[#1e2330] border-green-500 text-green-400" :
                      "bg-[#12141c] border-gray-800 text-gray-600"
                    }`}>
                      {idx + 1}
                    </div>
                    <span className={`text-[9px] font-bold mt-1.5 leading-none ${isActive ? "text-white" : "text-gray-600"}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Responder Information Card */}
            {activeSOS.driverId ? (
              <div className="bg-[#1e2330] p-4 rounded-2xl border border-gray-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-lg flex-shrink-0">
                  🚑
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">{activeSOS.driverId.name || "Paramedic Crew"}</h4>
                  <p className="text-[10px] text-gray-500 truncate">{activeSOS.driverId.email || "Smart Ambulance Driver"}</p>
                </div>
                <span className="text-[9px] font-mono font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-md uppercase flex-shrink-0">
                  {activeSOS.status.replace("_", " ")}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 bg-[#1e2330]/40 p-4 rounded-xl border border-dashed border-gray-800 text-yellow-500 text-xs">
                <FiLoader className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>Broadcasting SOS coordinates to nearest rescue units...</span>
              </div>
            )}

            {/* Live Navigation Map */}
            <div className="rounded-2xl overflow-hidden border border-gray-800 relative z-0">
              <MapComponent
                pickupLocation={activeSOS.pickupLocation}
                driverLocation={driverLocation}
                dropoffLocation={null}
                status={activeSOS.status}
              />
            </div>

            {/* Cancel Trigger */}
            <button
              onClick={handleCancelSOS}
              disabled={sosLoading}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FiXCircle className="w-4 h-4" />
              <span>Cancel SOS Dispatch</span>
            </button>
          </div>
        ) : (
          // Normal Credentials Login View
          <>
            <div className="text-center mb-6">
              <div className="inline-block bg-red-500/10 p-4 rounded-2xl text-red-500 mb-3 animate-pulse">
                <FiActivity className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">System Login</h1>
              <p className="text-sm text-gray-400 mt-1">Smart Ambulance Tracking System</p>
            </div>

            {/* Pulsing SOS Button */}
            <div className="mb-6 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-center space-y-3">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                  🚨 Life-Threatening Emergency?
                </span>
                <p className="text-[11px] text-gray-500 mt-0.5 font-medium leading-normal">
                  Dispatches the nearest available ambulance to your exact coordinates instantly.
                </p>
              </div>
              <button
                onClick={handleSOSClick}
                disabled={sosLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition duration-200 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden"
              >
                {sosLoading ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin" />
                    <span className="tracking-wide uppercase text-xs">Requesting Dispatch...</span>
                  </>
                ) : (
                  <>
                    <span className="tracking-wide uppercase text-xs font-black">TRIGGER IMMEDIATE SOS</span>
                  </>
                )}
              </button>
            </div>

            {/* Separator */}
            <div className="flex items-center my-6">
              <div className="flex-grow border-t border-gray-800/80"></div>
              <span className="mx-3 text-[10px] text-gray-600 uppercase font-bold tracking-wider">Or Login</span>
              <div className="flex-grow border-t border-gray-800/80"></div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4 text-center">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-3.5 text-gray-500" />
                  <input
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-red-500 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
                </div>
                <div className="relative">
                  <FiLock className="absolute left-3 top-3.5 text-gray-500" />
                  <input
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-red-500 transition"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Logging In..." : "Log In"}
              </button>
            </form>

            <div className="text-center mt-8">
              <p className="text-sm text-gray-400">
                Don't have an account?{" "}
                <Link to="/register" className="text-red-400 hover:text-red-300 font-semibold transition">
                  Sign Up
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
