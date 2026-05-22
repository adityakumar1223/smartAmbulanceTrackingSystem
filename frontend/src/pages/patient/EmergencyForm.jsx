import { useState } from "react";
import { useEmergency } from "../../context/EmergencyContext";
import { FiAlertCircle, FiChevronRight, FiMapPin } from "react-icons/fi";

const EmergencyForm = () => {
  const { createEmergency, loading } = useEmergency();
  const [formData, setFormData] = useState({
    emergencyType: "",
    patientNotes: "",
  });
  const [locationStatus, setLocationStatus] = useState("idle"); // idle, locating, success, error

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocationStatus("locating");

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          setLocationStatus("success");

          const emergencyPayload = {
            emergencyType: formData.emergencyType,
            patientNotes: formData.patientNotes,
            pickupLocation: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          };

          await createEmergency(emergencyPayload);
          alert("Emergency Request successfully dispatched!");
        },
        (error) => {
          console.error(error);
          setLocationStatus("error");
          alert("Unable to fetch exact GPS location. Please check browser permissions.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (error) {
      console.error("Emergency Form Error:", error);
      setLocationStatus("error");
      alert("Failed to submit request. Please try again.");
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