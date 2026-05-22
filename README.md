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
8. Finally, click **Complete Mission** when the patient is transported and secured. The trip is closed, resetting both dashboards to idle, and generating a permanent audit log!

### Phase 4: Command Center & Trauma Boards Auditing
1. Open a third tab and log in as the **Admin**:
   - Email: `admin@gmail.com`
   - Password: `password123`
2. You can view the live incident map tracking all active dispatches in real-time, inspect system statistics, and audit filterable log histories!
