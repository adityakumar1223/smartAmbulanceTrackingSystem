# 🚑 Smart Ambulance Tracking System

A real-time emergency medical dispatch and live ambulance tracking system built with Node.js, Express, MongoDB, Socket.io, React, Leaflet maps, and Tailwind CSS v4. The system auto-geolocates patient emergency incidents, matches them with available online paramedics, tracks route navigation in real-time with live ETAs, and integrates trauma centers (hospitals) and command hubs (admins) for live readiness preparation.

---

## 🔑 Default Test Credentials

For quick system evaluation, use these pre-configured accounts in the database. **All passwords have been synchronized to `password123`.**

| User Persona | Email | Username | Password | Role | Access Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Command Center** | `admin@gmail.com` | `admin1223` | `password123` | `admin` | Full incident tracking & audit log history |
| **Paramedic Crew (Driver)** | `driver@gmail.com` | `driver1223` | `password123` | `driver` | GPS transmitter controls & incident claim console |
| **Patient Account A** | `aditya@gmail.com` | `whoadii` | `password123` | `patient` | Emergency dispatch & stepper tracking map |
| **Patient Account B** | `aryan@gmail.com` | `aryakumar1223` | `password123` | `patient` | Emergency dispatch & stepper tracking map |
| **Trauma Center (Hospital)** | `pmch@hospital.com` | `patnamedicalcollegehospitalpmch` | `password123` | `hospital` | Live triage dashboard & capacity ledgers |

---

## 🛠️ Architecture & Tech Stack

```
                               ┌───────────────┐
                               │  Leaflet Map  │
                               └───────▲───────┘
                                       │
┌─────────────────────────┐     ┌──────┴──────┐     ┌─────────────────────────┐
│     Patient Portal      │◄───►│  Socket.io  │◄───►│    Paramedic Cockpit    │
│  (Auto Geolocation GPS) │     └──────▲──────┘     │   (watchPosition GPS)   │
└─────────────────────────┘            │            └─────────────────────────┘
                                ┌──────┴──────┐
                                │  Node/Mongo │
                                └─────────────┘
                                       ▲
                                       │
                        ┌──────────────┴──────────────┐
                        │   Admin / Hospital Panels   │
                        └─────────────────────────────┘
```

### Backend
- **Node.js & Express:** Lightweight, scalable server routing and REST API framework.
- **Mongoose & MongoDB:** Document-oriented database storage with customized `2dsphere` spatial indexing to calculate geolocation coordinates.
- **Mongoose Database Schemas:** 
  - **User Schema:** Enforces authenticated credentials, names, and access roles (`admin`, `driver`, `patient`, `hospital`).
  - **Emergency Request Schema:** Tracks pickup coordinates (`2dsphere` indexed), patient notes, dispatch status transitions, and driver associations.
  - **Post Schema:** Houses base64 image data, likes arrays, and interactive comments collections for the community feed.
  - **Hazard Schema:** Documents potholes, water logging, and road closures sorted by upvote telemetry.
- **Socket.io:** Real-time bi-directional WebSockets ensuring latency-free coordinate broadcasts.
- **JWT & BcryptJS:** High-security authentication tokens and hashed password encryptions.

### Frontend
- **React 19 & Vite:** Next-gen reactive view rendering and fast hot-module builds.
- **Tailwind CSS v4:** Sleek, hardware-accelerated fluid design aesthetics, custom dark mode, and micro-animations.
- **React Leaflet (OpenStreetMap):** High-performance vector map canvas plotting ambulance and patient GPS locations.
- **OpenRouteService API:** Generates real-time direction polylines, navigation paths, transit duration, and ETAs.

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas cluster or Local MongoDB instance

### 1. Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install server-side dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` root directory and supply variables:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://aditya:Aditya12@adityacluster.ljgzxqh.mongodb.net/?appName=AdityaCluster
   JWT_SECRET=mysecretkey
   ```
4. Start the server:
   ```bash
   npm start
   ```
   *(Or start with hot-reloading in dev mode using: `npm run dev`)*

### 2. Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install client-side dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend/` root directory and supply variables:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyCycsmSElR7DrZ-e6eEPxSZgNTwHQOx_d4
   VITE_ORS_API_KEY=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImIwMjM5YmE5YTZmZDRkOWQ4MTZiYWZmOTU1YWE1NjM0IiwiaCI6Im11cm11cjY0In0=
   VITE_API_URL=https://smartambulancetrackingsystem.onrender.com
   ```
4. Spin up the Vite local server:
   ```bash
   npm run dev
   ```
5. Access the application in your browser at `http://localhost:5173`.

---

## 🐞 Bug Fixes & Refactoring Logs

Here is a summary of crucial bugs fixed and structural refactorings made to bring the codebase to operational completeness:

1. **Authentication Failures Resolved:**
   - **Password Hashing Synchronization:** Reset all pre-seeded accounts in MongoDB to `"password123"` using a bcrypt-hashing script. Previously, the accounts had mismatching, undocumented credentials.
   - **Flexible Mongoose Schema:** Relaxed the `dob` (Date of Birth) constraint in [user.js](file:///d:/internship/collegeInternship/smartAmbulanceTrackingSystem/backend/models/user.js) from `required: true` to `required: false`. This prevents server registration validation errors when creating administrative or clinical hospital profiles that do not require birth date clinical tags.
   - **Friendly Username & Email Checks:** Refactored `registerUser` in [authController.js](file:///d:/internship/collegeInternship/smartAmbulanceTrackingSystem/backend/controllers/authController.js) to proactively check if a requested username or email is already taken. It now returns a robust `400 Bad Request` with a descriptive message rather than causing server crashes or letting raw Mongoose `E11000 duplicate index` exceptions interrupt the thread.
2. **Assigned Driver DB-Model Alignment:** 
   - *Issue:* The Mongoose schema specified `driverId` to associate paramedic crews, but the backend controller queried `assignedDriver`, causing mongoose queries, populate hooks, and updates to silently ignore driver associations.
   - *Fix:* Aligned all controller files to utilize the schema-compliant `driverId` field.
3. **Server-Crash Null Protections:**
   - *Issue:* When accepting trips or updating statuses, the controller validated inputs by checking `if(!requestId)` instead of checking if the database record (`request`) was found. If a request was not found, the server immediately crashed with a `TypeError` (attempting to read fields on a null object).
   - *Fix:* Implemented solid DB-record check `if(!request)` returning HTTP 404 responses.
4. **Broken Express Response Handlers:**
   - *Issue:* Controller try-catch blocks attempted to return error messages using `res.send(500).json(...)`. Because `.send` closes the socket and doesn't expose a `.json` method, these triggers threw additional server-side crashes.
   - *Fix:* Replaced all instances with express-compliant `.status().json(...)` methods.
5. **WebSocket Event Mismatch:**
   - *Issue:* The paramedic dashboard sent GPS updates using event `"Driver Location upadte: "` (misspelled with trailing whitespace and colons), while the server was listening to `"driverLocationUpdate"`. This caused live coordinates to be dropped.
   - *Fix:* Corrected WebSocket event names and implemented clean watch geolocation cleanup hooks on component unmount.
6. **Tailwind CSS v4 Integration:**
    - *Issue:* Tailwind was listed as a dependency but was missing in `vite.config.js` and was never imported into the stylesheets. Additionally, a rigid `#root` width block in `index.css` limited the screen width to `1126px` with inner borders.
    - *Fix:* Integrated `@tailwindcss/vite` plugin, imported `@import "tailwindcss";` in `index.css`, and removed the layout squeeze to create full-width dashboards.
7. **Leaflet Coordinate Crash Avoidance:**
   - *Issue:* React Leaflet threw an unhandled render exception that took down the entire React application tree (causing a blank screen) if `<MapContainer center={...}>` or `<Marker position={...}>` received coordinates resolving to `NaN` or `undefined` (which happened when active dispatches had empty coordinate arrays, creating a `{ lat: NaN, lng: NaN }` patientLocation object).
   - *Fix:* Integrated bulletproof coordinate validation flags (`hasValidAmbulanceCoords` and `hasValidPatientCoords`) into [MapComponent.jsx](file:///d:/internship/collegeInternship/smartAmbulanceTrackingSystem/frontend/src/components/map/MapComponent.jsx) to insulate markers, lines, and map containers. Added dynamic centering fallbacks (Ambulance ➔ Patient ➔ Patna, India) and wrapped all Leaflet markers/polylines in rendering guards.
8. **Page-Reload Blank Dashboard Crash (Race Condition):**
   - *Issue:* Reloading the browser while on the Driver Dashboard immediately crashed the view and showed a blank screen. This was caused by a race condition between `ProtectedRoute.jsx` (which synchronously read credentials from `localStorage`) and `AuthContext.jsx` (which initialized `user` as `null` and parsed profile data asynchronously in a `useEffect` hook). This caused the dashboard to render with `user = null` on the first frame, crashing on `user.id` inside the GPS hook's dependency array.
   - *Fix:* Destructured `authLoading` from `useAuth()`, applied optional chaining `user?.id` inside both the geolocation coordinates callback and the hook dependency list, and placed a sleek glassmorphic early loading guard (`if (authLoading || !user)`) at the end of the hook block to ensure perfect startup sync.
9. **Global Sidebar Brand Header Overflow:**
   - *Issue:* A rigid global `h1` style override in `index.css` forced sidebar brand logos to be excessively large, pushing the brand name ("SmartAmbulance") out of the sidebar container width and causing ugly text wrapping on desktop viewports.
   - *Fix:* Cleaned up global tag-level font sizes and refactored sidebar headers to semantic, flexible `span` block elements with responsive CSS sizing across all dashboards.
10. **Production API & WebSocket Dynamic Routing Integration:**
    - *Issue:* The API connection base URL (`api.js`) and the Socket.io client connection endpoint (`socket.js`) were hardcoded to `"http://localhost:5000"`. This made production deployments (e.g., deploying the backend to Render at `https://smartambulancetrackingsystem.onrender.com`) fail to establish a connection without manually rewriting system code files.
    - *Fix:* Refactored both configurations to dynamically load `import.meta.env.VITE_API_URL` as the primary connection address with a stable fallback to localhost for seamless offline local development.
11. **JWT Expiry & State Synchronization Improvements:**
    - **Axios 401 Interceptor:** Added a request/response Axios interceptor in [api.js](file:///d:/internship/collegeInternship/smartAmbulanceTrackingSystem/frontend/src/services/api.js) to automatically trigger user logout and session cleanup if any backend API query returns an HTTP `401 Unauthorized` response (e.g., when the 7-day token expires).
    - **ProtectedRoute State Sync:** Corrected `ProtectedRoute` to listen directly to React AuthContext instead of raw, stale `localStorage` keys, ensuring routes reactively lock down instantly upon logout.
    - **LogoutButton Desync Fix:** Programmed `LogoutButton` to call the `logout()` method in `AuthContext` to clear memory states and broadcast session closure, stopping ghost sessions.
12. **WebSockets Integrity & Performance Tweaks:**
    - **Clean Socket Unbinding:** Fixed a typo in `EmergencyContext.jsx` where socket cleanup called `.off("emergencyStatusUpdate")` instead of `"emergencyStatusUpdated"`, leaving loose handlers.
    - **Duplicate Listener Cleanup:** Removed double `"driverLocationUpdated"` listener bindings from `MapComponent` and centralized coordinates updates in `EmergencyContext` to prevent state drift and dual firing.
    - **Static Map Keys:** Replaced dynamic coordinate key props on Leaflet maps with static keys to prevent heavy Leaflet container re-mounting on every GPS telemetry tick.
13. **Backend Database Refactoring:**
    - **Sparse Username Index:** Configured `sparse: true` on the Mongoose unique `username` index inside the User schema. This permits multiple guest/patient accounts registered with null usernames to co-exist without triggering MongoDB duplicate index errors.
    - **Efficient Seeding Lifecycle:** Relocated the initial community database seed validation script from the routing handler path to a single-run trigger on Express server startup.
14. **Dashboard Community API Synchronization:**
    - Replaced all local-storage mock updates inside the Patient and Driver dashboard community widgets with real backend API routes (`/api/community/posts`, `/api/community/hazards`), allowing posts, comment threads, upvotes, and images to sync across all connected clients in real-time.
15. **ReferenceError Blank Page & State Recovery:**
    - Fixed a page-mount crash on the Hospital Dashboard caused by referencing `FiAlertTriangle` which was used but never imported in the script.
    - Fixed a secondary `ReferenceError: totalIncoming is not defined` crash by restoring the `totalIncoming` variable definition, which is referenced by the sidebar navigation button badge.
    - Wrapped the Hospital Dashboard in a React `ErrorBoundary` wrapper to catch and show readable debug diagnostics on-screen rather than presenting a blank screen, and added safe fallback mappings across all listing items.

---

## 🌟 Newly Developed Premium Features

### 1. High-Fidelity Community Hub & Road Hazards Bulletin (`/community`)
We have developed a comprehensive, real-time shared Community Center designed to keep emergency networks aligned, connected, and safe:
- **Shared Access Routing:** Registered a secure, protected `/community` route accessible by all roles (Patients, Paramedics, Hospitals, Admins), featuring dedicated sidebar navigation links.
- **Interactive Stream Feed:** Allows users to share route updates or announcements, attach screenshots using a raw local `FileReader` Base64 parser, like posts, and expand comment threads to interact in real-time.
- **Suggested Medical Network:** A connections sidebar where paramedics and medical staff can click "Connect" to send requests. It exhibits a simulated synchronization lifecycle state ("Connect" ➔ "Syncing..." ➔ "Connected") with perfect client-side local caching.
- **Active Road Hazards Board:** A tactical route-safety bullet board where users can report potholes, construction, flooding, or road blocks with specific severity tags (`low`, `medium`, `critical`) and descriptions. The board dynamically upvotes safety reports and **automatically sorts incidents so that the most severe, highly-voted blockages bubble instantly to the top**, alerting incoming ambulance rigs in real-time.
- **State Persistence:** Integrated robust `localStorage` state adapters across the social stream, network directory, and hazard bulletin, preserving data seamlessly across browser updates.

### 2. Always-On Live Sidebar GPS Radar Maps
We integrated high-tech, live GPS tracking radars directly into the desktop sidebars of both **Patient** and **Driver** dashboards:
- **Patient Sidebar Radar:** Continuously polls telemetry coordinates, displaying a glowing emerald green pulsar indicating active GPS and printed monospaced lat/lng badges.
- **Driver State Machine Radar:** Synchronizes directly with the driver's online presence:
  - **Offline cover overlay:** If offline, hides the map and displays a beautiful, blurred glass cover with a flashing "Radar Offline" alert, encouraging them to toggle online to broadcast their location.
  - **Calibrating state:** Displays a glowing "📡 Calibrating GPS..." banner when toggling online while geolocation permissions or signals are resolving.
  - **Online live radar:** Once active, displays a high-contrast dark military-radar centered on their live coordinates.
- **Premium Dark Cybernetic Tile Styling:** Applied custom CSS matrix shifts (`filter: invert(90%) hue-rotate(180deg)...`) to convert standard map canvases into a gorgeous glowing dark-theme tactical display.

### 3. Hospital Dashboard (Triage Radar, Active Onboard Patients Monitor & Trauma Capacity Ledger)
An all-in-one clinic console designed for hospital personnel and emergency ward directors:
- **Live Incoming Triage Radar:** Continuously updates a dashboard registry displaying incoming ambulance units, patient names, en-route status, trauma priority tags (e.g., Cardiac Alert, Trauma Accident, Pregnancy Case), and triage notes.
- **Active Onboard Patients Monitor:** A dedicated dashboard monitor panel capturing ambulance units with stabilized patients onboard in transit (status `arrived`).
- **Interactive Live Route Tracking Modal:** Integrated Leaflet routing maps within a modal drawer, letting coordinators track en-route ambulances with path polyline overlays, live distance calculations, and telemetry synchronization indicators.
- **Trauma Capacity Settings:** Synchronizes active capacity ledgers (ICU Bed availability, Operating Theaters preparedness, active Surgical specialist teams, and the primary emergency ward hotline) with instant `localStorage` saving and live transmission support.
- **Automated Routing Alignment:** The synchronized triage data automatically routes to dispatch units on the road, enabling crew drivers to make informed routing decisions in transit.
- **Role-based Security:** Restricts access to authenticated hospital accounts with interactive sidebar switching between the community hub, radar, and settings consoles.

### 4. Patient Dashboard (Medical Profile Ledger & Live Coordinates Radar)
A high-tech patient dispatch terminal prioritizing automated emergency workflows and clinical data integrity:
- **Personal Emergency Record Ledger:** A clinical metadata interface where patients manage blood groups, insurance policies, drug allergies, pre-existing conditions, and emergency SOS contacts. Vitals are automatically package-bundled and routed directly to claiming ambulance rigs and trauma wards upon booking trigger.
- **Live Coordinates Radar Tab:** Continuous real-time location telemetry with coordinates (latitude, longitude) and signal accuracy (± meters) tracked via `navigator.geolocation.watchPosition`.
- **Cybernetic Map Tiles:** Standard Leaflet maps are transformed into a tactical military style with dynamic centration and coordinate markers.
- **Unified Navigation Console:** Seamless sidebar tabs allowing patients to easily jump from the active dispatch map, community hub, profile editor, and live radar coordinates display.

### 5. Admin Dashboard (System-Wide Dispatch Audit & Incident Maps)
A central command hub console for real-time fleet overview and auditing:
- **Metrics Overview Grid:** Displays high-fidelity tally boxes containing total emergencies logged, pending claims, active rescues, and completed trips.
- **Real-Time Incident Map Radar:** Dynamically plots active pickups and en route transit markers with clickable popup description bubbles.
- **Filter & Audit Log Table:** Allows admin operators to filter the entire database of rescue requests by their lifecycle state (`all`, `pending`, `accepted`, `on_the_way`, `arrived`, `completed`, `cancelled`) with instant tabular view updates.

### 6. Production Deployment & SPA Rewrite Routing
Fully containerized routing parameters designed for high-availability cloud host providers:
- **Single-Page Application (SPA) Vercel Config:** Supply a customized `vercel.json` rewrite file to proxy index redirects (`/(.*) -> /index.html`). This completely eliminates blank screens and 404 navigation errors on user console page reloads.
- **Dynamic CORS & API Endpoint Swapping:** Refactored server configuration files to map production Render URLs (`https://smartambulancetrackingsystem.onrender.com`) dynamically using environment variables (`import.meta.env.VITE_API_URL`) while retaining seamless local offline fallbacks.

---

## 🏃 End-to-End Simulation Walkthrough

To verify the real-time ambulance tracking system and see the dynamic, glassmorphic dashboards interact, follow these steps:

### Phase 1: Set Up the Paramedic Availability
1. Open a browser window and navigate to the Login page (`http://localhost:5173`).
2. Log in with the **Driver** account:
   - Email: `driver@gmail.com`
   - Password: `password123`
3. You will be taken to the premium **Paramedic Cockpit** dashboard.
4. Locate the **OFFLINE / IDLE** toggle at the top right and click it.
5. The button will glow green and switch to **ONLINE / WATCHING GPS**. The dashboard is now actively broadcasting ambulance coordinates live and listening for emergency dispatches!

### Phase 2: Dispatch an Emergency (Patient Portal)
1. Open a second browser window (preferably in Incognito mode) or side-by-side tab and go to `http://localhost:5173`.
2. Log in with a **Patient** account:
   - Email: `aditya@gmail.com`
   - Password: `password123`
3. You will land on the **Patient Command Center**. The map will automatically query your browser's geolocation to pin your exact incident coordinate!
4. Click the red **Dispatch Ambulance** button or submit the **Emergency Report Form**. Select an incident category (e.g., *Cardiac Arrest* or *Severe Bleeding*) and add optional symptoms.
5. Submit the dispatch request. Your Patient dashboard will immediately switch to an active stepper state (**"Awaiting Paramedic Claim..."**).

### Phase 3: Paramedic Claims & Coordinates Streaming
1. Switch back to your **Driver** dashboard tab.
2. An **Incoming Emergency Mission Alert** popup will start pulsing and flashing red on your screen, complete with patient diagnostics and notes!
3. Click the red **Claim Rescue** button on the driver popup.
4. The incident has been claimed! 
   - **Driver Map:** Draws the route polyline from the paramedic coordinates directly to the patient's pinned location, showing live ETA and navigation directions.
   - **Patient Map:** The Patient's dashboard instantly shifts into a live mapping state, drawing the approaching ambulance's marker and streaming live ETAs!
5. On the **Driver dashboard**, click the **Start Transit** button. This shifts the tracking status to `on_the_way` and begins broadcasting the driver's real-time movement.
6. As the driver's location shifts, the OpenRouteService API dynamically recalculates route polylines and updates the approaching ETA in real-time on both screens.
7. Click **Crew Arrived** when the driver reaches the patient's site, updating the status to `arrived`.
   - **Hospital Dashboard Verification:** In a third browser tab, log in as the Trauma Center:
     - Email: `pmch@hospital.com`
     - Password: `password123`
     You will see this active emergency instantly move from the "Ambulances En Route" panel to the **"Ambulances with Patients Onboard"** grid.
   - **Live Map Route Tracking:** Click the **"Track Live Route"** button on the patient onboard card. This opens an interactive Leaflet tracking modal plotting the ambulance's location marker and route path in real-time, matching the driver's GPS coordinates.
8. Finally, click **Complete Mission** when the patient is transported and secured. The trip is closed, resetting both dashboards to idle, and generating a permanent audit log!

### Phase 4: Command Center & Trauma Boards Auditing
1. Open a third tab and log in as the **Admin**:
   - Email: `admin@gmail.com`
   - Password: `password123`
2. You can view the live incident map tracking all active dispatches in real-time, inspect system statistics, and audit filterable log histories!
