import MapComponent from "../../components/map/MapComponent";
import { FiAlertCircle, FiChevronRight, FiNavigation, FiXCircle, FiCheckSquare } from "react-icons/fi";

const ActiveTrip = ({ trip, onUpdateStatus, loading, driverLocation, patientLiveLocation }) => {
  if (!trip) return null;

  const handleNextStatus = async () => {
    let nextStatus = "";
    if (trip.status === "accepted") nextStatus = "on_the_way";
    else if (trip.status === "on_the_way") nextStatus = "arrived";
    else if (trip.status === "arrived") nextStatus = "completed";

    if (nextStatus) {
      await onUpdateStatus(trip._id, nextStatus);
    }
  };

  const handleCancel = async () => {
    if (window.confirm("Are you sure you want to cancel this emergency rescue mission?")) {
      await onUpdateStatus(trip._id, "cancelled");
    }
  };

  return (
    <div className="bg-[#161a23]/60 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl shadow-2xl shadow-black/40 space-y-8 font-sans">
      
      {/* Title */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-6">
        <div>
          <span className="text-xs font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
            Active Emergency Rescue
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-2">Navigation Console</h2>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500">Trip Code:</span>
          <p className="text-sm font-semibold text-white font-mono">{trip._id.substring(trip._id.length - 8).toUpperCase()}</p>
        </div>
      </div>

      {/* Grid: Patient Details & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Patient Details */}
        <div className="bg-[#12141c] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Patient Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-800/40 pb-2">
                <span className="text-gray-500">Name:</span>
                <span className="text-white font-bold">{trip.patientId?.name || "Emergency Incident"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/40 pb-2">
                <span className="text-gray-500">Priority Level:</span>
                <span className="text-red-400 capitalize font-bold">{trip.emergencyType.replace("_", " ")}</span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-gray-500 text-xs">Medical Symptoms:</span>
                <p className="text-xs text-white italic bg-[#1e2330] p-3 rounded-lg border border-gray-800/50">
                  "{trip.patientNotes || "No symptoms noted by dispatcher."}"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Progress and controls */}
        <div className="md:col-span-2 bg-[#12141c] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mission Workflow Controls</h3>
            <p className="text-xs text-gray-500">Advance the trip state as you perform milestones along the rescue journey.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Advance Status Button */}
            {trip.status !== "completed" && trip.status !== "cancelled" && (
              <button
                onClick={handleNextStatus}
                disabled={loading}
                className="py-4 px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-2xl transition shadow-lg shadow-green-950/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {trip.status === "accepted" && (
                  <>
                    <FiNavigation className="w-5 h-5" />
                    <span>Start Transit Journey</span>
                  </>
                )}
                {trip.status === "on_the_way" && (
                  <>
                    <FiAlertCircle className="w-5 h-5" />
                    <span>Mark Ambulance Arrived</span>
                  </>
                )}
                {trip.status === "arrived" && (
                  <>
                    <FiCheckSquare className="w-5 h-5" />
                    <span>Complete Rescue Mission</span>
                  </>
                )}
              </button>
            )}

            {/* Cancel Rescue Button */}
            {trip.status !== "completed" && trip.status !== "cancelled" && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="py-4 px-6 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FiXCircle className="w-5 h-5" />
                <span>Cancel Mission</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Map */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <FiNavigation />
          Live Route Navigation Map
        </h3>
        <div className="rounded-3xl overflow-hidden border border-gray-800 relative z-0">
          <MapComponent
            pickupLocation={
              patientLiveLocation ? {
                type: "Point",
                coordinates: [patientLiveLocation.lng, patientLiveLocation.lat]
              } : trip.pickupLocation
            }
            driverLocation={driverLocation}
            dropoffLocation={trip.dropoffLocation}
            status={trip.status}
          />
        </div>
      </div>

    </div>
  );
};

export default ActiveTrip;
