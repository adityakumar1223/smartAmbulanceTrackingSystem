// import React from "react";
import {useState} from "react"
import { useNavigate } from "react-router-dom";
import axios from 'axios';

function Login(){

    
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        setFormData({ 
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post("http://localhost:5000/api/auth/login", formData);

            const data = response.data;
            console.log(data);

            //store token
            localStorage.setItem("token", data.token);
            localStorage.setItem("role",data.user.role);

            //redirected by role
            if(data.user.role === "admin"){
                alert("login sucessful");
                navigate("/admin",{
                    replace: true
                });
            }else if(data.user.role === "patient"){
                alert("login sucessful");
                navigate("/patient",{
                    replace: true
                });
            }else if(data.user.role === "driver"){
                alert("login sucessful");
                navigate("/driver",{
                    replace: true
                })
            }else if(data.user.role === "hospital"){
                alert("login sucessful");
                navigate("/hospital",{
                    replace: true
                })
            }
        } catch (error) {
            console.log(error);
            alert("login failed");
        }
        
    };

    return (

        <div>

        <h1>login</h1>
        <form onSubmit={handleSubmit} >
            <input type="email" name="email" placeholder="Enter your email" onChange={handleChange} />

            <br/><br />

            <input type="password" name="password" placeholder="Enter password" onChange={handleChange} />

            <br /><br />

            <button type="submit" >Login</button>
            
        </form>
            
        </div>
        
    );
    
}

export default Login;

