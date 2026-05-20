import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom';

import PatientDashboard from './pages/patient/PatientDashboard.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import DriverDashboard from './pages/driver/DriverDashboard.jsx';
import HospitalDashboard from './pages/hospital/HospitalDashboard.jsx';
import LiveTracking from './components/map/LiveTracking.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Login from "./pages/Login.jsx";

function App() {

  return (
    
    <BrowserRouter>
    
      <Routes>

        <Route 

        path="/"
        element={<Login />}
        
        />

        <Route 
        path='/patient'
        element={
          <ProtectedRoute 
          allowedRole="patient">
        <PatientDashboard/>
        </ProtectedRoute>
      } 
         />

         <Route
         path="/admin"
         element={
         <ProtectedRoute 
         allowedRole="admin">
         <AdminDashboard/>
         </ProtectedRoute>
         }
         />

         <Route 
         path="/driver"
         element={
          <ProtectedRoute
          allowedRole="driver">
         <DriverDashboard/>
         </ProtectedRoute>
         }
         />

         <Route 
         path="/hospital"
         element={
          <ProtectedRoute
          allowedRole="hospital">
         <HospitalDashboard/>
         </ProtectedRoute>
         }
         />

         <Route
         path="/login"
         element={
          <Login />
         } />

         <Route 
         path="/tracking"
         element={<LiveTracking/>}
         />

      </Routes>

    </BrowserRouter>
  );

}

export default App;
