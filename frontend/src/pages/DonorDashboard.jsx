// src/pages/DonorDashboard.jsx (REVAMPED for Modern Donor Experience)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../App.css'; 

// API Endpoints - Ensure your backend is running on port 3000
const API_CAMPAIGN_ACTIVE = 'http://localhost:3000/api/campaigns/active';
const API_DONATION = 'http://localhost:3000/api/donations';
const API_PROJECT_PROGRESS = 'http://localhost:3000/api/projects/progress'; 

function DonorDashboard() {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [activeCampaigns, setActiveCampaigns] = useState([]);
    const [donationHistory, setDonationHistory] = useState([]);
    const [projects, setProjects] = useState([]); 
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Donation form state
    const [donationData, setDonationData] = useState({ campId: '', amount: '' });
    
    // Quick Donation Amounts
    const quickAmounts = [500, 1000, 2500, 5000];

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    // Helper functions
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        // Use 'en-IN' for Indian date format
        return new Date(dateString).toLocaleDateString('en-IN'); 
    };
    const formatCurrency = (amount) => {
        if (amount == null) return 'N/A';
        // Use 'en-IN' for Indian currency format (Rupees)
        return `₹${Number(amount).toLocaleString('en-IN')}`; 
    };

    // --- Fetch Data Functions ---
    const fetchActiveCampaigns = async () => {
        try {
            const response = await axios.get(API_CAMPAIGN_ACTIVE, { headers });
            setActiveCampaigns(response.data.campaigns);
            // Set the first active campaign as the default for the donation form
            if (response.data.campaigns.length > 0) {
                setDonationData(prev => ({ ...prev, campId: response.data.campaigns[0].CAMP_ID }));
            }
        } catch (err) {
            console.error('Fetch campaigns error:', err);
        }
    };

    const fetchDonationHistory = async () => {
        try {
            // This route automatically fetches history for the authenticated DONOR
            const response = await axios.get(API_DONATION, { headers });
            setDonationHistory(response.data.donations);
        } catch (err) {
            console.error('Fetch donation history error:', err);
        }
    };
    
    const fetchProjects = async () => {
        try {
            // This fetches project progress used for the "Your Impact" section
            const response = await axios.get(API_PROJECT_PROGRESS, { headers });
            setProjects(response.data.projects);
        } catch (err) {
            console.error('Fetch projects error:', err);
        }
    };

    useEffect(() => {
        if (token) {
            setLoading(true);
            // Fetch all required data concurrently
            Promise.all([
                fetchActiveCampaigns(),
                fetchDonationHistory(),
                fetchProjects()
            ]).finally(() => setLoading(false));
        }
    }, [token]);

    // --- Donation Logic ---

    const handleDonationChange = (e) => {
        setDonationData({ ...donationData, [e.target.name]: e.target.value });
        setError('');
        setSuccessMessage('');
    };
    
    // Handler for Quick Donation buttons
    const handleQuickDonate = (amount) => {
        if (!donationData.campId) {
            return setError('Please select an active campaign first.');
        }
        handleSubmitDonation(null, amount); // Call the submit function directly
    };

    const handleSubmitDonation = async (e, quickAmount = null) => {
        if (e) e.preventDefault();
        
        setError('');
        setSuccessMessage('');
        
        const finalAmount = quickAmount !== null ? quickAmount : Number(donationData.amount);
        
        if (finalAmount <= 0 || isNaN(finalAmount)) {
            return setError('Donation amount must be a positive number.');
        }

        if (!donationData.campId) {
            return setError('Please select a campaign to donate to.');
        }
        
        const donationPayload = { 
            campId: donationData.campId, 
            amount: finalAmount, 
            // The backend uses req.user.primaryId from the JWT, but sending it as a backup
            donId: user.primaryId 
        };


        try {
            const response = await axios.post(API_DONATION, donationPayload, { headers });
            
            setSuccessMessage(`Donation of ${formatCurrency(finalAmount)} recorded! Redirecting to receipt...`);
            setDonationData(prev => ({ ...prev, amount: '' })); // Clear amount input
            fetchDonationHistory(); // Refresh history
            fetchProjects(); // Refresh progress (optional, for project updates)
            
            // Redirect to receipt page (assuming you have a DonorReceipt.jsx component)
            const newDonId = response.data.donId; 
            setTimeout(() => navigate(`/receipt/${newDonId}`), 1500); 

        } catch (err) {
            console.error('Donation error:', err.response?.data);
            setError(err.response?.data?.message || 'Failed to process donation. Check network and backend setup.');
        }
    };

    // Calculate donor summary data
    const totalDonations = donationHistory.reduce((sum, d) => sum + d.AMOUNT, 0);
    const distinctCampaigns = new Set(donationHistory.map(d => d.C_NAME)).size;


    if (loading) return <div className="loading">Loading Donor Dashboard...</div>;

    return (
        <div className="dashboard-container">
            {/* --- WELCOME MESSAGE --- */}
            <h1 className="text-center" style={{marginBottom: '10px'}}>
                <span style={{color: 'var(--primary-color)'}}>👋 Welcome, {user.FNAME || user.LNAME || 'Valued Donor'}!</span>
            </h1>
            <p className="text-center" style={{ marginBottom: '40px', color: '#666' }}>
                Thank you for your generosity. Here is your impact summary.
            </p>

            {/* --- DASHBOARD SUMMARY CARDS --- */}
            <div className="card-grid">
                <div className="card-box card-primary">
                    <p>Total Donations</p>
                    <h3>{formatCurrency(totalDonations)}</h3>
                </div>
                <div className="card-box card-secondary">
                    <p>Campaigns Supported</p>
                    <h3>{distinctCampaigns}</h3>
                </div>
                <div className="card-box card-success">
                    <p>Active Projects</p>
                    {/* Filter projects that are not yet 100% spent */}
                    <h3>{projects.filter(p => p.SPENDING_PERCENT < 100).length}</h3>
                </div>
            </div>

            {/* --- DONATION SECTION --- */}
            <h2 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginTop: '40px' }}>Make a Donation Today</h2>
            
            {error && <p className="message-error text-center">{error}</p>}
            {successMessage && <p className="message-success text-center">{successMessage}</p>}

            <div className="donation-section">
                {/* Campaign Selection Dropdown (Placed above both donation options) */}
                <div className="form-group campaign-selector">
                    <label>Select Campaign:</label>
                    <select 
                        name="campId" 
                        value={donationData.campId} 
                        onChange={handleDonationChange} 
                        required
                        style={{textAlign: 'center'}}
                    >
                        <option value="" disabled>-- Select a Campaign --</option>
                        {activeCampaigns.length === 0 ? (
                            <option value="">No Active Campaigns</option>
                        ) : (
                            activeCampaigns.map(camp => (
                                <option key={camp.CAMP_ID} value={camp.CAMP_ID}>
                                    {camp.C_NAME} (Goal: {formatCurrency(camp.GOAL_AMOUNT)})
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>
            
            <div className="donation-section grid-2">
                
                {/* 1. Quick Donation Panel */}
                <div className="quick-donation-panel card-box">
                    <h3>Quick Donation</h3>
                    <p style={{color: '#666'}}>Select a pre-set amount for a fast checkout.</p>
                    <div className="quick-amounts-grid">
                        {quickAmounts.map(amount => (
                            <button 
                                key={amount} 
                                onClick={() => handleQuickDonate(amount)} 
                                className="btn btn-quick"
                                disabled={!donationData.campId}
                            >
                                {formatCurrency(amount)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Custom Donation Panel (Basic Donation) */}
                <div className="custom-donation-panel card-box">
                    <h3>Custom Donation</h3>
                    <form onSubmit={handleSubmitDonation}>
                        <div className="form-group">
                            <label>Amount (₹):</label>
                            <input
                                type="number"
                                name="amount"
                                value={donationData.amount}
                                onChange={handleDonationChange}
                                placeholder="Enter custom amount..."
                                min="1"
                                step="any"
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={!donationData.campId || !donationData.amount}>
                            Donate {donationData.amount ? formatCurrency(donationData.amount) : 'Now'}
                        </button>
                    </form>
                </div>
            </div>

            {/* --- PROJECT PROGRESS & HISTORY --- */}
            
            <h2 style={{ marginTop: '40px', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>Your Impact & History</h2>

            {/* Project Progress (View of the projects your funds support) */}
            <h3 style={{marginTop: '20px'}}>Projects In Progress</h3>
            <div className="table-responsive">
                {projects.length === 0 ? (
                    <p>No projects available for funding updates yet.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Project Name</th>
                                <th>Budget</th>
                                <th>Spent</th>
                                <th>Progress</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(proj => (
                                <tr key={proj.PROJ_ID}>
                                    <td>{proj.PNAME}</td>
                                    <td>{formatCurrency(proj.BUDGET)}</td>
                                    <td>{formatCurrency(proj.SPENT)}</td>
                                    <td>
                                        {/* Uses CSS styling for progress bar */}
                                        <div className="progress-bar-container">
                                            <div 
                                                style={{ 
                                                    width: `${Math.min(100, proj.SPENDING_PERCENT)}%`, 
                                                    backgroundColor: proj.SPENDING_PERCENT >= 100 ? 'var(--danger-color)' : 'var(--success-color)'
                                                }}
                                                className="progress-bar-fill"
                                            >
                                                {proj.SPENDING_PERCENT}%
                                            </div>
                                        </div>
                                    </td>
                                    <td>{proj.SPENDING_PERCENT >= 100 ? 'Completed/Over' : 'In Progress'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Donation History */}
            <h3 style={{marginTop: '40px'}}>Your Donation History</h3>
            <div className="table-responsive">
                {donationHistory.length === 0 ? (
                    <p>You have no donation history yet. Make your first donation above!</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Campaign</th>
                                <th>Amount</th>
                                <th>Receipt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {donationHistory.map(donation => (
                                <tr key={donation.DON_ID}>
                                    <td>{formatDate(donation.DON_DATE)}</td>
                                    <td>{donation.C_NAME}</td>
                                    <td>{formatCurrency(donation.AMOUNT)}</td>
                                    <td>
                                        <button 
                                            onClick={() => navigate(`/receipt/${donation.DON_ID}`)}
                                            className="btn btn-small btn-secondary"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
        </div>
    );
}

export default DonorDashboard;