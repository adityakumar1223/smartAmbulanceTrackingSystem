import { FiCheckCircle, FiClock, FiStar, FiPercent } from "react-icons/fi";

const DriverStats = ({ completedCount = 14, activeHours = "48h", rating = "4.9", completionRate = "98%" }) => {
  const stats = [
    {
      label: "Completed Rescues",
      value: completedCount,
      desc: "Total missions resolved",
      icon: <FiCheckCircle className="w-5 h-5 text-green-400" />,
      color: "bg-green-500/10 border-green-500/20 text-green-400",
    },
    {
      label: "Duty Time Active",
      value: activeHours,
      desc: "Online service hours",
      icon: <FiClock className="w-5 h-5 text-blue-400" />,
      color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    },
    {
      label: "Responder Rating",
      value: rating,
      desc: "Patient review average",
      icon: <FiStar className="w-5 h-5 text-yellow-400" />,
      color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    },
    {
      label: "Acceptance Rate",
      value: completionRate,
      desc: "Assigned mission success",
      icon: <FiPercent className="w-5 h-5 text-purple-400" />,
      color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="bg-[#161a23] border border-gray-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {stat.label}
            </span>
            <div className={`p-2 rounded-xl border ${stat.color}`}>
              {stat.icon}
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-white tracking-tight">{stat.value}</h3>
            <p className="text-[10px] text-gray-500 mt-1">{stat.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DriverStats;
