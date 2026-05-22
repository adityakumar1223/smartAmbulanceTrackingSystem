import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiUser, FiMail, FiLock, FiCalendar, FiSmile } from "react-icons/fi";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "patient",
    dob: "",
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
      await register(formData);
      alert("Registration successful! Please log in.");
      navigate("/");
    } catch (error) {
      console.error(error);
      setErrorMsg(error.response?.data?.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0e1015] px-4 font-sans">
      <div className="bg-[#161a23]/80 backdrop-blur-xl border border-gray-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl shadow-black/50">
        <div className="text-center mb-6">
          <div className="inline-block bg-red-500/10 p-3 rounded-2xl text-red-500 mb-2">
            <FiSmile className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-sm text-gray-400 mt-1">Smart Ambulance Tracking System</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-3.5 text-gray-500" />
                <input
                  type="text"
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Username</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-3.5 text-gray-500" />
                <input
                  type="text"
                  name="username"
                  placeholder="johndoe12"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>
          </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Password</label>
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

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date of Birth</label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-3.5 text-gray-500" />
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#1e2330] border border-gray-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Role</label>
            <div className="grid grid-cols-4 gap-2">
              {["patient", "driver", "hospital", "admin"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: r })}
                  className={`py-2 px-1 text-xs font-bold rounded-lg border transition capitalize ${
                    formData.role === r
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : "bg-[#1e2330] border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl transition duration-200 shadow-md shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <Link to="/" className="text-red-400 hover:text-red-300 font-semibold transition">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
