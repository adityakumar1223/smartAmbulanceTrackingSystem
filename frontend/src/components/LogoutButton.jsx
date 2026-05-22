import { useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";

function LogoutButton(){
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");

        navigate("/", {
            replace: true,
        });
    }

    return (
        <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 rounded-xl transition duration-200 text-sm font-bold shadow-md cursor-pointer"
        >
            <FiLogOut className="w-4 h-4" />
            Logout
        </button>
    );
}

export default LogoutButton;