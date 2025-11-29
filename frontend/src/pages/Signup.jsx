// src/pages/Signup.jsx (MODERNIZED UI)

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../App.css'; 

const API_URL = 'http://localhost:3000/api/auth/signup';

function Signup() {
    const [formData, setFormData] = useState({
        aadharNo: '',
        password: '',
        email: '',
        userType: 'DONOR', 
        fname: '',
        lname: '',
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        try {
            const response = await axios.post(API_URL, formData);
            setMessage(response.data.message + " Redirecting to login...");
            setError('');
            setTimeout(() => navigate('/login'), 2000); 
        } catch (err) {
            console.error('Signup error:', err.response?.data);
            setError(err.response?.data?.message || 'Network error: Check server connection and CORS.');
            setMessage('');
        }
    };

    return (
        <div className="auth-container"> {/* Use a specific container for centering */}
            <div className="form-card"> {/* New wrapper for the modern card look */}
                <h2 className="text-center" style={{ color: 'var(--success-color)' }}>
                    Create Account
                </h2>
                <p className="text-center" style={{ marginBottom: '25px', color: '#666' }}>
                    Join us as a Donor or Staff member.
                </p>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group-grid"> {/* Grid layout for name fields */}
                        <div className="form-group">
                            <label>First Name:</label>
                            <input type="text" name="fname" value={formData.fname} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Last Name:</label>
                            <input type="text" name="lname" value={formData.lname} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email:</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    
                    <div className="form-group">
                        <label>Aadhar No. (12 digits):</label>
                        <input 
                           type="text" name="aadharNo" value={formData.aadharNo} onChange={handleChange} 
                           maxLength="12" pattern="\d{12}" title="Aadhar must be exactly 12 digits." required />
                    </div>
                    
                    <div className="form-group">
                        <label>Password (Min 6 chars):</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} minLength="6" required />
                    </div>
                    
                    <div className="form-group">
                        <label>User Type:</label>
                        <select name="userType" value={formData.userType} onChange={handleChange}>
                            <option value="DONOR">Donor</option>
                            <option value="STAFF">Staff</option>
                        </select>
                    </div>

                    {message && <p className="message-success">{message}</p>}
                    {error && <p className="message-error">{error}</p>}

                    <button type="submit" className="btn btn-success" style={{ marginTop: '20px' }}>
                        Sign Up
                    </button>
                </form>
                
                <p className="text-center" style={{ marginTop: '25px' }}>
                    Already have an account? <a href="/login">Login</a>
                </p>
            </div>
        </div>
    );
}

export default Signup;