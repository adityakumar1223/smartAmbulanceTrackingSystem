import { FiAlertTriangle, FiCheck, FiNavigation, FiClock } from "react-icons/fi";

const IncomingRequest = ({ request, onAccept, loading }) => {
  if (!request) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 md:inset-x-auto md:right-6 md:bottom-6 z-[2000] max-w-md w-full animate-bounce">
      <div className="bg-[#1a1216]/95 border-2 border-red-500/40 rounded-3xl p-6 shadow-2xl shadow-red-950/40 backdrop-blur-md">
        
        {/* Blinking Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </div>
          <span className="text-red-400 font-extrabold text-xs uppercase tracking-widest">
            Critical Emergency Mission
          </span>
        </div>

        {/* Details card */}
        <div className="space-y-4 text-sm bg-[#161a23]/80 p-5 rounded-2xl border border-gray-800">
          <div className="flex justify-between border-b border-gray-800 pb-2">
            <span className="text-gray-500 font-semibold">Severity / Type:</span>
            <span className="text-white capitalize font-bold text-base flex items-center gap-1.5 text-red-500">
              <FiAlertTriangle />
              {request.emergencyType.replaceAll("_", " ")}
            </span>
          </div>
          
          <div className="flex justify-between border-b border-gray-800 pb-2">
            <span className="text-gray-500 font-semibold">Patient Name:</span>
            <span className="text-white font-semibold">{request.patientId?.name || "Patient Incident"}</span>
          </div>

          <div className="space-y-1">
            <span className="text-gray-500 font-semibold block">Incident Location Notes:</span>
            <p className="text-gray-300 italic text-xs leading-relaxed">
              &quot;{request.patientNotes || 'No condition comments provided.'}&quot;
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="flex flex-col justify-center text-xs text-gray-500 pl-1">
            <span className="flex items-center gap-1">
              <FiClock />
              Dispatch Active
            </span>
            <span className="font-bold text-[#9ca3af]">Near Coordinates Pinned</span>
          </div>

          <button
            onClick={() => onAccept(request._id)}
            disabled={loading}
            className="py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-950/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FiCheck />
            {loading ? "Accepting..." : "Accept Mission"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default IncomingRequest;
