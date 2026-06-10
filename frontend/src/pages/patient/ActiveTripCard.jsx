import { useState } from "react";
import { useEmergency } from "../../context/EmergencyContext";
import MapComponent from "../../components/map/MapComponent";
import { FiLoader, FiCheckCircle, FiTruck, FiMapPin, FiPhone, FiRefreshCw } from "react-icons/fi";

const ActiveTripCard = () => {
  const { activeEmergency, driverLocation, cancelEmergency, connectToNextDriver, loading } = useEmergency();
  const [switchingAmbulance, setSwitchingAmbulance] = useState(false);
  const [switchMessage, setSwitchMessage] = useState("");

  if (!activeEmergency) {
    return null;
  }

  const handleCancel = async () => {
    if (window.confirm("Are you sure you want to cancel this emergency request?")) {
      try {
        await cancelEmergency(activeEmergency._id);
        alert("Emergency request has been cancelled.");
      } catch (error) {
        console.error("Error cancelling ride:", error);
        alert("Failed to cancel emergency request. Please try again.");
      }
    }
  };

  // Handles "Change Ambulance" for PENDING requests (no driver yet)
  // and "Connect to other ambulance" for accepted requests (switch drivers)
  const handleConnectToOther = async () => {
    setSwitchingAmbulance(true);
    setSwitchMessage("");
    try {
      await connectToNextDriver(activeEmergency._id);
      if (activeEmergency.status === "pending") {
        setSwitchMessage("✓ Searching for the nearest available ambulance...");
      } else {
        setSwitchMessage("✓ Switched to the next closest ambulance!");
      }
      setTimeout(() => setSwitchMessage(""), 4000);
    } catch (error) {
      const msg = error.response?.data?.message || "No other ambulances available nearby. Please wait or call emergency services.";
      setSwitchMessage(`⚠ ${msg}`);
      setTimeout(() => setSwitchMessage(""), 5000);
    } finally {
      setSwitchingAmbulance(false);
    }
  };

  const getStepIndex = (status) => {
    switch (status) {
      case "pending": return 0;
      case "accepted": return 1;
      case "on_the_way": return 2;
      case "arrived": return 3;
      case "completed": return 4;
      default: return 0;
    }
  };

  const steps = [
    { label: "Dispatched", desc: "Waiting for driver" },
    { label: "Accepted", desc: "Driver assigned" },
    { label: "En Route", desc: "Ambulance on the way" },
    { label: "Arrived", desc: "Medical crew on site" },
    { label: "Completed", desc: "Trip finished" },
  ];

  const currentStep = getStepIndex(activeEmergency.status);
  const isPending = activeEmergency.status === "pending";

  // Show "Change Ambulance" for every status BEFORE the driver starts transit.
  // Once the driver clicks "Start Transit Journey" (status → in_transit / boarded),
  // the patient is already in the ambulance — switching is no longer meaningful.
  const canChangeAmbulance = ["pending", "accepted", "on_the_way", "arrived"].includes(activeEmergency.status);

  return (
    <div className="bg-[#161a23]/60 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl shadow-2xl shadow-black/40 space-y-8 font-sans">

      {/* ── Title Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Active Emergency</h2>
          <p className="text-xs text-gray-500 mt-1">Real-time live monitoring portal</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            disabled={loading || switchingAmbulance}
            className="px-3.5 py-1.5 bg-red-600/10 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition duration-200 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Cancelling..." : "Cancel Ride"}
          </button>
          <span className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-xs font-bold uppercase tracking-wider text-red-400">
            <FiTruck className="animate-bounce" />
            {isPending ? "Waiting for Acceptance" : activeEmergency.status.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      {/* ── Waiting Banner (pending only) ─────────────────────── */}
      {isPending && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-2xl flex items-center gap-3 text-xs animate-pulse">
          <FiLoader className="w-4.5 h-4.5 animate-spin flex-shrink-0" />
          <span className="font-semibold uppercase tracking-wider">
            Searching for the nearest available ambulance...
          </span>
        </div>
      )}

      {/* ── Change Ambulance Card ─────────────────────────────────
           Visible for: pending → accepted → on_the_way → arrived
           Hidden once driver starts transit (in_transit / boarded)
      ──────────────────────────────────────────────────────────── */}
      {canChangeAmbulance && (
        <div className="p-5 bg-[#12141c] border border-blue-500/20 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
              <FiRefreshCw className={`w-4 h-4 ${switchingAmbulance ? "animate-spin" : ""}`} />
            </div>
            <div className="flex-1">
              <h4 className="text-white text-sm font-bold">
                {isPending ? "No ambulance assigned yet?" : "Need a different ambulance?"}
              </h4>
              <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
                {isPending
                  ? "Click below to connect to the nearest available ambulance using live proximity search."
                  : "You can switch to another nearby ambulance any time before the driver starts the transit journey."}
              </p>
            </div>
          </div>

          <button
            id="change-ambulance-btn"
            onClick={handleConnectToOther}
            disabled={switchingAmbulance || loading}
            className="w-full py-3 flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-600/20 to-blue-700/20 hover:from-blue-600/30 hover:to-blue-700/30 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {switchingAmbulance ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                Searching for nearest ambulance...
              </>
            ) : (
              <>
                <FiRefreshCw className="w-4 h-4" />
                {isPending ? "Find Nearest Ambulance" : "Change Ambulance"}
              </>
            )}
          </button>

          {/* Feedback message after switch attempt */}
          {switchMessage && (
            <p className={`text-xs text-center font-semibold px-3 py-2 rounded-xl border ${switchMessage.startsWith("✓")
                ? "bg-green-500/10 border-green-500/20 text-green-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
              {switchMessage}
            </p>
          )}
        </div>
      )}

      {/* ── Stepper Timeline ──────────────────────────────────── */}
      <div className="hidden md:grid grid-cols-5 gap-2 relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-800 -z-10" />
        {steps.map((step, idx) => {
          const isActive = idx <= currentStep;
          const isCurrent = idx === currentStep;
          return (
            <div key={idx} className="text-center flex flex-col items-center z-10">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border font-bold text-sm transition-all duration-300 ${isCurrent
                    ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30 scale-110"
                    : isActive
                      ? "bg-[#1e2330] border-green-500 text-green-400"
                      : "bg-[#12141c] border-gray-800 text-gray-600"
                  }`}
              >
                {isActive && idx < currentStep ? <FiCheckCircle className="w-5 h-5" /> : idx + 1}
              </div>
              <h4 className={`text-xs font-bold mt-3 transition ${isActive ? "text-white" : "text-gray-600"}`}>
                {step.label}
              </h4>
              <p className="text-[10px] text-gray-500 mt-0.5">{step.desc}</p>
            </div>
          );
        })}
      </div>

      {/* ── Request Details & Driver Info Grid ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#12141c] p-6 rounded-2xl border border-gray-800/60">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Emergency Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-gray-800/40 pb-2">
              <span className="text-gray-500">Incident Type:</span>
              <span className="text-white capitalize font-semibold">
                {activeEmergency.emergencyType.replaceAll("_", " ")}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-800/40 pb-2">
              <span className="text-gray-500">Condition Notes:</span>
              <span className="text-white italic">{activeEmergency.patientNotes || "No notes provided"}</span>
            </div>
          </div>
        </div>

        {/* Assigned Responder */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Driver</h3>
          {activeEmergency.driverId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 bg-[#1e2330] p-4 rounded-xl border border-gray-800">
                <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center font-bold">
                  {activeEmergency.driverId.name ? activeEmergency.driverId.name.charAt(0) : "D"}
                </div>
                <div className="flex-grow">
                  <h4 className="text-sm font-semibold text-white">{activeEmergency.driverId.name || "Paramedic Crew"}</h4>
                  <p className="text-xs text-gray-500">{activeEmergency.driverId.email || "Smart Ambulance Driver"}</p>
                </div>
                <a
                  href={`tel:${activeEmergency.driverId.phone || "911"}`}
                  className="w-9 h-9 rounded-lg bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white flex items-center justify-center transition"
                >
                  <FiPhone className="w-4 h-4" />
                </a>
              </div>

              {/* The dedicated "Change Ambulance" card above (canChangeAmbulance)
                  handles all switching for both pending and post-acceptance states.
                  No duplicate button needed here. */}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-[#1e2330]/40 p-4 rounded-xl border border-dashed border-gray-800 text-yellow-500 text-sm">
              <FiLoader className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>Matching nearest rescue unit... Please hold on.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Live Map ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <FiMapPin />
          Live Route Navigation Map
        </h3>
        <div className="rounded-2xl overflow-hidden border border-gray-800 relative z-0">
          <MapComponent
            pickupLocation={activeEmergency.pickupLocation}
            driverLocation={driverLocation}
            dropoffLocation={activeEmergency.dropoffLocation}
            status={activeEmergency.status}
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveTripCard;