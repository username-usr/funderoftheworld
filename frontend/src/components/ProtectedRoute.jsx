// src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component to protect routes based on authentication and user role.
 * * @param {object} props
 * @param {React.ReactElement} props.element - The component to render if authorized.
 * @param {string|string[]} props.requiredType - The required user type(s) ('DONOR', 'STAFF').
 */
function ProtectedRoute({ element, requiredType }) {
    const { user, token } = useAuth();
    
    // --- 1. CHECK AUTHENTICATION ---
    if (!token) {
        // Not logged in, redirect to login
        return <Navigate to="/login" replace />;
    }

    const userType = user?.userType;

    // --- 2. CHECK AUTHORIZATION (ROLE) ---
    let isAuthorized = false;
    
    // Handle array of required types (e.g., ['DONOR', 'STAFF'] for the receipt page)
    if (Array.isArray(requiredType)) {
        isAuthorized = requiredType.includes(userType);
    } 
    // Handle single required type (e.g., 'STAFF' for the Staff Dashboard)
    else if (typeof requiredType === 'string') {
        isAuthorized = (userType === requiredType);
    }
    // Note: If user is logged in but has no defined type, they fail authorization.

    // --- 3. RENDER OR REDIRECT ---
    if (isAuthorized) {
        return element; // Authorized, render the requested component
    } else {
        // Logged in but unauthorized for this specific path 
        // Redirect them back to their appropriate dashboard
        const redirectPath = userType === 'STAFF' ? '/dashboard/staff' : '/dashboard/donor';
        
        // Use console.error for security/debugging visibility
        console.error(`Access denied for user type: ${userType}. Redirecting to ${redirectPath}`);
        return <Navigate to={redirectPath} replace />;
    }
}

export default ProtectedRoute;