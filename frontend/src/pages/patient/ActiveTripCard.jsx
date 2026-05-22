import { useEmergency } from "../../context/EmergencyContext";
import MapComponent from "../../components/map/MapComponent";
import { FiLoader, FiCheckCircle, FiTruck, FiMapPin, FiPhone } from "react-icons/fi";

const ActiveTripCard = () => {
  const { activeEmergency, driverLocation } = useEmergency();

  if (!activeEmergency) {
    return null;
  }

  // Get active step index for the tracker
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

  const steps = [
    { label: "Dispatched", desc: "Waiting for driver" },
    { label: "Accepted", desc: "Driver assigned" },
    { label: "En Route", desc: "Ambulance on the way" },
    { label: "Arrived", desc: "Medical crew on site" },
    { label: "Completed", desc: "Trip finished" },
  ];

  const currentStep = getStepIndex(activeEmergency.status);

  return (
    <div className="bg-[#161a23]/60 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl shadow-2xl shadow-black/40 space-y-8 font-sans">
      {/* Title Header */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Active Emergency</h2>
          <p className="text-xs text-gray-500 mt-1">Real-time live monitoring portal</p>
        </div>
        <span className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-xs font-bold uppercase tracking-wider text-red-400">
          <FiTruck className="animate-bounce" />
          {activeEmergency.status.replace("_", " ")}
        </span>
      </div>

      {/* Stepper Timeline */}
      <div className="hidden md:grid grid-cols-5 gap-2 relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-800 -z-10" />
        {steps.map((step, idx) => {
          const isActive = idx <= currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div key={idx} className="text-center flex flex-col items-center z-10">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border font-bold text-sm transition-all duration-300 ${
                  isCurrent
                    ? "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30 scale-110"
                    : isActive
                    ? "bg-[#1e2330] border-green-500 text-green-400"
                    : "bg-[#12141c] border-gray-800 text-gray-600"
                }`}
              >
                {isActive && idx < currentStep ? (
                  <FiCheckCircle className="w-5 h-5" />
                ) : (
                  idx + 1
                )}
              </div>
              <h4
                className={`text-xs font-bold mt-3 transition ${
                  isActive ? "text-white" : "text-gray-600"
                }`}
              >
                {step.label}
              </h4>
              <p className="text-[10px] text-gray-500 mt-0.5">{step.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Grid: Request details and Driver Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#12141c] p-6 rounded-2xl border border-gray-800/60">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Emergency Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-gray-800/40 pb-2">
              <span className="text-gray-500">Incident Type:</span>
              <span className="text-white capitalize font-semibold">{activeEmergency.emergencyType.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800/40 pb-2">
              <span className="text-gray-500">Condition Notes:</span>
              <span className="text-white italic">{activeEmergency.patientNotes || "No notes provided"}</span>
            </div>
          </div>
        </div>

        {/* Assigned Responder */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Dispatcher</h3>
          {activeEmergency.driverId ? (
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
          ) : (
            <div className="flex items-center gap-3 bg-[#1e2330]/40 p-4 rounded-xl border border-dashed border-gray-800 text-yellow-500 text-sm">
              <FiLoader className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>Matching nearest rescue unit... Please hold on.</span>
            </div>
          )}
        </div>
      </div>

      {/* Map Live Tracking */}
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
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveTripCard;