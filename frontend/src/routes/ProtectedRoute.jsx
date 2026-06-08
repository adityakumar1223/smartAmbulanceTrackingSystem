import { Navigate, Link } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, allowedRole }) {
    const { user, loading } = useAuth();
    const token = localStorage.getItem("token");
    const role = user?.role || localStorage.getItem("role");

    if (!token) {
        return <Navigate to="/" replace />;
    }

    // wrong role
    if (allowedRole && role !== allowedRole) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0e1015] text-[#9ca3af] px-6">
                <div className="bg-[#161a23] p-8 rounded-2xl border border-red-500/20 max-w-md w-full text-center shadow-xl shadow-black/40">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 text-red-500 mx-auto mb-6">
                        <FiAlertTriangle className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 font-heading">Access Denied</h1>
                    <p className="text-sm text-gray-400 mb-6">
                        You do not have the required permissions to access this page. This area is reserved for {allowedRole} accounts.
                    </p>
                    <Link
                        to="/"
                        className="inline-block w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-red-900/30"
                    >
                        Go to Authentication
                    </Link>
                </div>
            </div>
        );
    }

    // allowed 
    return children;
}

export default ProtectedRoute;