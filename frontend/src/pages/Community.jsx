import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LogoutButton from "../components/LogoutButton";
import { FiActivity, FiUser } from "react-icons/fi";
import CommunityHub from "../components/community/CommunityHub";

function Community() {
  const { user } = useAuth();

  // Helper: Back to user role dashboard URL
  const getDashboardPath = () => {
    if (user?.role === "admin") return "/admin";
    if (user?.role === "driver") return "/driver";
    if (user?.role === "hospital") return "/hospital";
    return "/patient";
  };

  return (
    <div className="min-h-screen bg-[#0e1015] text-[#9ca3af] font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="border-b border-gray-800 bg-[#161a23]/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to={getDashboardPath()} className="flex items-center gap-3 hover:opacity-95 transition animate-fadeIn">
              <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500 shadow-lg shadow-red-950/20">
                <FiActivity className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-xl font-bold text-white tracking-tight block">SmartAmbulance</span>
                <p className="text-xs text-gray-500 font-medium">Community Network Hub</p>
              </div>
            </Link>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-4">
            <Link 
              to={getDashboardPath()}
              className="px-4 py-2 bg-[#1e2330] border border-gray-800 hover:border-gray-700 text-white font-semibold rounded-xl text-xs transition duration-200 shadow-sm uppercase tracking-wider"
            >
              Back to Dashboard
            </Link>
            
            {user && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#1e2330] rounded-xl border border-gray-800">
                <FiUser className="text-gray-400" />
                <span className="text-xs text-white font-bold capitalize">{user.name} ({user.role})</span>
              </div>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* RENDER COMMUNITY HUB (STANDALONE MODE) */}
      <CommunityHub isDashboard={false} />

    </div>
  );
}

export default Community;
