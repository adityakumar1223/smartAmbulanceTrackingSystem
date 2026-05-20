import { h1 } from 'framer-motion/client';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({children, allowedRole}){

    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role")

    if(!token){
        return (<Navigate to="/" replace />);
    }

    // wrong role
    if(role !== allowedRole){
        return (
            <h1>Page not found 404</h1>
        );
    }

    //allowed 
    return children;
}

export default ProtectedRoute;