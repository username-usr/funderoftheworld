// src/App.jsx (Ensure this structure is used)

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import all page components
import Login from './pages/Login';
import Signup from './pages/Signup';
import StaffDashboard from './pages/StaffDashboard'; 
import DonorDashboard from './pages/DonorDashboard'; 
import DonorReceipt from './pages/DonorReceipt'; // <-- Make sure this is imported
import ProtectedRoute from './components/ProtectedRoute'; // <-- Make sure this is imported
import { AuthProvider } from './context/AuthContext'; // Assuming you use AuthProvider
import Navbar from './components/Navbar'; // <-- Make sure this is imported

function App() {
    return (
        <Router>
            <AuthProvider>
                {/* ⬇️ RENDER NAVBAR OUTSIDE ROUTES
                  We use an element check to only show the Navbar when a user is logged in
                  (i.e., only on Protected Routes).
                */}
                <Routes>
                    {/* Check if current path is a protected dashboard */}
                    <Route 
                        path="/dashboard/*" 
                        element={<Navbar />} 
                    />
                    <Route 
                        path="/receipt/*" 
                        element={<Navbar />} 
                    />
                </Routes>


                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Protected Routes (Require Authentication and Role Check) */}
                    <Route
                        path="/dashboard/staff"
                        element={<ProtectedRoute element={<StaffDashboard />} requiredType="STAFF" />} 
                    />
                    <Route
                        path="/dashboard/donor"
                        element={<ProtectedRoute element={<DonorDashboard />} requiredType="DONOR" />}
                    />
                    <Route
                        path="/receipt/:donId"
                        element={<ProtectedRoute element={<DonorReceipt />} requiredType={['DONOR', 'STAFF']} />} 
                    />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;