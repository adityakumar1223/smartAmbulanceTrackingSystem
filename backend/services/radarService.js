const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY || 'prj_test_sk_0000000000000000000000000000000000000000';

const syncDriverLocation = async (driverId, latitude, longitude) => {
    try {
        if (!RADAR_SECRET_KEY || RADAR_SECRET_KEY.includes("00000000")) {
            console.log(`[Radar Sandbox] Simulated location sync for driver ${driverId}: [${longitude}, ${latitude}]`);
            return { success: true, simulated: true };
        }

        const response = await fetch("https://api.radar.io/v1/track", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": RADAR_SECRET_KEY
            },
            body: JSON.stringify({
                userId: driverId.toString(),
                latitude,
                longitude,
                metadata: {
                    type: "ambulance"
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`Radar track failed with status ${response.status}: ${errText}`);
            return { success: false, status: response.status };
        }

        const data = await response.json();
        console.log(`Radar location synced for driver ${driverId}: [${longitude}, ${latitude}]`);
        return { success: true, data };
    } catch (err) {
        console.error("Error in Radar syncDriverLocation service:", err);
        return { success: false, error: err.message };
    }
};

const findNearestAmbulances = async (patientLat, patientLng, limit = 5) => {
    try {
        if (!RADAR_SECRET_KEY || RADAR_SECRET_KEY.includes("00000000")) {
            console.log(`[Radar Sandbox] Simulated nearest ambulances search near: [${patientLng}, ${patientLat}]`);
            return null; // Fallback to DB
        }

        const url = `https://api.radar.io/v1/search/users?near=${patientLat},${patientLng}&limit=${limit}&metadata[type]=ambulance`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": RADAR_SECRET_KEY
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`Radar search users failed with status ${response.status}: ${errText}`);
            return null;
        }

        const data = await response.json();
        return data.users || [];
    } catch (err) {
        console.error("Error in Radar findNearestAmbulances service:", err);
        return null;
    }
};

module.exports = {
    syncDriverLocation,
    findNearestAmbulances
};
