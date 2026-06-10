import { useState } from "react";
import { useEmergency } from "../../context/EmergencyContext";
import { FiAlertCircle, FiChevronRight, FiMapPin, FiCamera, FiTrash2, FiCpu, FiLoader } from "react-icons/fi";
import Radar from "radar-sdk-js";
import api from "../../services/api.js";

const EmergencyForm = () => {
  const { createEmergency, loading } = useEmergency();
  const [formData, setFormData] = useState({
    emergencyType: "",
    patientNotes: "",
  });
  const [locationStatus, setLocationStatus] = useState("idle"); // idle, locating, success, error

  // AI Snap States
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuccessMsg, setAiSuccessMsg] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setAiError("");
    setAiSuccessMsg("");

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setAiError("");
    setAiSuccessMsg("");
  };

  const uploadToAI = async () => {
    if (!imageFile) {
      setAiError("Please select or capture an image first.");
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiSuccessMsg("");

    const fd = new FormData();
    fd.append("image", imageFile);

    try {
      const response = await api.post("/emergency/ai-process", fd, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data && response.data.success) {
        const { description, severity, estimated_victims, suggested_ambulance_type } = response.data.data;

        // Formulate Heuristics to auto-select emergencyType
        let mappedType = "general";
        const descLower = (description || "").toLowerCase();
        const ambLower = (suggested_ambulance_type || "").toLowerCase();

        if (descLower.includes("accident") || descLower.includes("crash") || descLower.includes("collision") || descLower.includes("trauma") || descLower.includes("injury") || ambLower.includes("trauma")) {
          mappedType = "accident";
        } else if (descLower.includes("heart") || descLower.includes("cardiac") || descLower.includes("stroke") || descLower.includes("chest pain") || descLower.includes("cardiovascular") || ambLower.includes("cardiac")) {
          mappedType = "heart_attack";
        } else if (descLower.includes("pregnancy") || descLower.includes("birth") || descLower.includes("labor") || descLower.includes("delivery") || descLower.includes("pregnant") || ambLower.includes("obstetric")) {
          mappedType = "pregnancy";
        }

        // Fill form fields
        setFormData({
          emergencyType: mappedType,
          patientNotes: `AI Diagnosis:\n${description}\n\nSeverity: ${severity}\nEstimated Victims: ${estimated_victims}\nSuggested Ambulance: ${suggested_ambulance_type}`
        });

        setAiSuccessMsg("Emergency scene analyzed successfully! Form pre-filled. Please review and submit.");
      } else {
        setAiError("Failed to analyze the scene. Please enter the details manually.");
      }
    } catch (error) {
      console.error("AI upload error:", error);
      const errMsg = error.response?.data?.message || "Error communicating with AI service. Please fill in the details manually.";
      setAiError(errMsg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocationStatus("locating");

    const handleSuccess = async (lat, lng) => {
      setLocationStatus("success");
      const emergencyPayload = {
        emergencyType: formData.emergencyType,
        patientNotes: formData.patientNotes,
        pickupLocation: {
          type: "Point",
          coordinates: [lng, lat],
        },
      };

      try {
        await createEmergency(emergencyPayload);
      } catch (err) {
        console.error("Failed to dispatch emergency:", err);
        setLocationStatus("error");
        alert("Failed to dispatch emergency request. Please try again.");
      }
    };

    const handleFallback = () => {
      if (!navigator.geolocation) {
        setLocationStatus("error");
        alert("Geolocation is not supported by your browser");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleSuccess(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("Native Geolocation Error:", error);
          setLocationStatus("error");
          alert("Unable to fetch exact GPS location. Please check browser permissions.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    try {
      Radar.trackOnce()
        .then((result) => {
          if (result && result.location) {
            handleSuccess(result.location.latitude, result.location.longitude);
          } else {
            handleFallback();
          }
        })
        .catch((error) => {
          console.warn("Radar trackOnce error, falling back to Geolocation:", error);
          handleFallback();
        });
    } catch (error) {
      console.error("Emergency Form Error:", error);
      handleFallback();
    }
  };

  return (
    <div className="bg-[#161a23]/60 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl shadow-2xl shadow-black/40">
      <div className="flex items-center gap-3 border-b border-gray-800 pb-6 mb-6">
        <div className="bg-red-500/10 p-3 rounded-2xl text-red-500 shadow-inner">
          <FiAlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Request Emergency Ambulance</h2>
          <p className="text-xs text-gray-500 mt-1">Dispatches the nearest available rescue vehicle to your GPS coordinates</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* AI Emergency Snap Section */}
        <div className="bg-[#1e2330]/40 border border-gray-800/80 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">AI Emergency Snap</span>
            </div>
            <span className="text-[10px] text-gray-500 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded-full font-mono">Beta</span>
          </div>

          {!imagePreview ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-800 hover:border-red-500/50 hover:bg-red-500/5 transition duration-300 rounded-2xl py-6 px-4 cursor-pointer text-center group">
              <FiCamera className="w-8 h-8 text-gray-500 group-hover:text-red-400 transition mb-2" />
              <span className="text-xs font-semibold text-gray-400 group-hover:text-gray-200 transition">Snap or Upload Scene Photo</span>
              <span className="text-[10px] text-gray-600 mt-1">Uses device camera to pre-fill the form using AI vision</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-gray-800 group h-48 bg-black/20 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Emergency Preview"
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-3 right-3 bg-red-600 hover:bg-red-500 text-white p-2 rounded-xl transition shadow-lg opacity-90 hover:opacity-100 cursor-pointer"
                  title="Remove Image"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>

              {aiError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {aiSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
                  {aiSuccessMsg}
                </div>
              )}

              <button
                type="button"
                onClick={uploadToAI}
                disabled={aiLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-600 text-white font-bold rounded-xl text-xs transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {aiLoading ? (
                  <>
                    <FiLoader className="w-4 h-4 animate-spin text-blue-400" />
                    <span>AI Analyzing Emergency Scene...</span>
                  </>
                ) : (
                  <>
                    <FiCpu className="w-4 h-4 text-blue-400" />
                    <span>Analyze Scene with AI</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Emergency Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Emergency Severity & Type</label>
          <select
            name="emergencyType"
            value={formData.emergencyType}
            onChange={handleChange}
            required
            className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:border-red-500 transition cursor-pointer"
          >
            <option value="">Select Emergency Type</option>
            <option value="accident">Accident / Collision Trauma</option>
            <option value="heart_attack">Cardiac Arrest / Stroke</option>
            <option value="pregnancy">Pregnancy / Labor</option>
            <option value="general">Severe Infection / General Emergency</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Patient Symptoms & Condition Details</label>
          <textarea
            name="patientNotes"
            value={formData.patientNotes}
            onChange={handleChange}
            placeholder="Describe physical status, conscious levels, breathing difficulty, or address comments to assist responders..."
            rows={5}
            className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:border-red-500 transition resize-none"
          />
        </div>

        {/* Geolocation Status Indicator */}
        {locationStatus !== "idle" && (
          <div className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            locationStatus === "locating" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
            locationStatus === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" :
            "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <FiMapPin className={`w-4 h-4 ${locationStatus === "locating" ? "animate-bounce" : ""}`} />
            <span>
              {locationStatus === "locating" && "Obtaining precise satellite GPS coordinates..."}
              {locationStatus === "success" && "GPS coordinates successfully fetched and pinned!"}
              {locationStatus === "error" && "Failed to gather precise coordinates. Please authorize permissions."}
            </span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || locationStatus === "locating"}
          className="w-full group py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-2xl transition duration-200 shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>
            {loading ? "Dispatching Services..." : "Request Ambulance Instantly"}
          </span>
          <FiChevronRight className="w-5 h-5 group-hover:translate-x-1 transition duration-200" />
        </button>
      </form>
    </div>
  );
};

export default EmergencyForm;