// src/pages/Login.jsx (MODERNIZED UI)

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../App.css'; 

const API_URL = 'http://localhost:3000/api/auth/login';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        try {
            const response = await axios.post(API_URL, { email, password });
            
            login(response.data.token, {
                primaryId: response.data.primaryId,
                userType: response.data.userType,
            });

            if (response.data.userType === 'STAFF') {
                navigate('/dashboard/staff');
            } else {
                navigate('/dashboard/donor');
            }
        } catch (err) {
            console.error('Login error:', err.response?.data);
            setError(err.response?.data?.message || 'Login failed. Check server connection.');
        }
    };

    return (
        <div className="auth-container"> {/* Use a specific container for centering */}
            <div className="form-card"> {/* New wrapper for the modern card look */}
                <h2 className="text-center" style={{ color: 'var(--primary-color)' }}>
                    Welcome Back!
                </h2>
                <p className="text-center" style={{ marginBottom: '25px', color: '#666' }}>
                    Sign in to your Charity System account.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email:</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password:</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    
                    {error && <p className="message-error">{error}</p>}
                    
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '20px' }}>
                        Login
                    </button>
                </form>
                
                <p className="text-center" style={{ marginTop: '25px' }}>
                    Don't have an account? <a href="/signup">Sign Up here</a>
                </p>
            </div>
        </div>
    );
}

export default Login;