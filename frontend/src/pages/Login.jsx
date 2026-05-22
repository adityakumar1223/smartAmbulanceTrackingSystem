import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiMail, FiLock, FiActivity } from "react-icons/fi";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0e1015] px-4 font-sans">
      <div className="bg-[#161a23]/80 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl max-w-md w-full shadow-2xl shadow-black/50">
        <div className="text-center mb-8">
          <div className="inline-block bg-red-500/10 p-4 rounded-2xl text-red-500 mb-3 animate-pulse">
            <FiActivity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Login</h1>
          <p className="text-sm text-gray-400 mt-1">Smart Ambulance Tracking System</p>
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
      </div>
    </div>
  );
}

export default Login;
