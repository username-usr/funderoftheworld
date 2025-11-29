// src/components/Navbar.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Import icons: FaUserCircle for profile, FaSignOutAlt for logout
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import '../App.css'; // Ensure your styles are imported

function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Determine the user's display name
    const displayName = user.FNAME || user.LNAME || (user.userType === 'DONOR' ? 'Donor' : 'Staff');
    
    // Determine the dashboard path for the Profile/Logo click
    const dashboardPath = user.userType === 'DONOR' ? '/dashboard/donor' : '/dashboard/staff';

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            logout();
            navigate('/login');
        }
    };
    
    // Function to navigate to the correct dashboard on logo click
    const goToDashboard = () => {
        navigate(dashboardPath);
    };

    return (
        <nav className="navbar-top">
            {/* Logo/App Name - Clicks back to dashboard */}
            <div className="navbar-logo" onClick={goToDashboard}>
                <span className="logo-icon">❤️</span>
                <span className="logo-text">CharityApp</span>
            </div>

            <div className="navbar-actions">
                {/* Profile Display (Name and Icon) */}
                <div className="navbar-profile">
                    <FaUserCircle className="profile-icon" />
                    <span className="profile-name">{displayName}</span>
                </div>

                {/* Logout Button */}
                <button 
                    className="btn btn-icon-text btn-logout" 
                    onClick={handleLogout}
                    title="Logout"
                >
                    <FaSignOutAlt className="logout-icon" />
                    <span>Logout</span>
                </button>
            </div>
        </nav>
    );
}

export default Navbar;