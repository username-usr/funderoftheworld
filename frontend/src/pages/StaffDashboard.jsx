// src/pages/StaffDashboard.jsx (MODERNIZED UI)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../App.css'; // Assuming this imports the necessary styles

// API Endpoints
const API_CAMPAIGN = 'http://localhost:3000/api/campaigns';
const API_PROJECT = 'http://localhost:3000/api/projects';
const API_CAMPAIGN_SUMMARY = 'http://localhost:3000/api/campaigns/financial-summary';
const API_DONOR_SUMMARY = 'http://localhost:3000/api/donors/summary';

function StaffDashboard() {
    const { user, token, logout } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [campaignSummary, setCampaignSummary] = useState([]);
    const [donorSummary, setDonorSummary] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Form states
    const [campFormData, setCampFormData] = useState({ cName: '', goalAmount: '', sDate: '', eDate: '' });
    const [projFormData, setProjFormData] = useState({ pName: '', budget: '', sDate: '', campId: '' });

    // State for Expense Modal
    const [expenseModal, setExpenseModal] = useState({
        isOpen: false,
        projId: null,
        pName: '',
        expenseAmount: ''
    });

    // State for Link Campaign Modal
    const [linkModal, setLinkModal] = useState({
        isOpen: false,
        projId: null,
        pName: '',
        campId: ''
    });

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    // Helper function to format dates
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN');
    };
    
    // Helper function to format currency
    const formatCurrency = (amount) => {
        if (amount == null) return 'N/A';
        return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };


    // --- Fetch Projects ---
    const fetchProjects = async () => {
        try {
            const response = await axios.get(API_PROJECT, { headers });
            setProjects(response.data.projects);
            return { status: 'fulfilled' };
        } catch (err) {
            console.error('Fetch project error:', err.response?.data || err);
            return { status: 'rejected', reason: 'Failed to load projects.' };
        }
    };

    // --- Fetch Campaigns ---
    const fetchCampaigns = async () => {
        try {
            const response = await axios.get(API_CAMPAIGN, { headers });
            const allCampaigns = response.data.campaigns;
            setCampaigns(allCampaigns);
            if (allCampaigns.length > 0) {
                 setProjFormData(prev => ({ ...prev, campId: allCampaigns[0].CAMP_ID }));
            }
            return { status: 'fulfilled' };
        } catch (err) {
            console.error('Fetch campaign error:', err.response?.data || err);
            return { status: 'rejected', reason: 'Failed to load campaigns for forms.' };
        }
    };

    // --- Fetch Campaign Summary ---
    const fetchCampaignSummary = async () => {
        try {
            const response = await axios.get(API_CAMPAIGN_SUMMARY, { headers });
            setCampaignSummary(response.data.summary);
            return { status: 'fulfilled' };
        } catch (err) {
            console.error('Fetch campaign summary error:', err.response?.data || err);
            return { status: 'rejected', reason: 'Failed to load campaign financial summary.' };
        }
    };

    // --- Fetch Donor Summary Function ---
    const fetchDonorSummary = async () => {
        try {
            const response = await axios.get(API_DONOR_SUMMARY, { headers });
            setDonorSummary(response.data.donors);
            return { status: 'fulfilled' };
        } catch (err) {
            console.error('Fetch donor summary error:', err.response?.data || err);
            return { status: 'rejected', reason: 'Failed to load donor list.' };
        }
    };

    // --- Unified Fetch Function ---
    const fetchData = async () => {
        setLoading(true);
        setError('');
        setSuccessMessage('');

        const results = await Promise.allSettled([
            fetchCampaigns(),
            fetchProjects(),
            fetchCampaignSummary(),
            fetchDonorSummary()
        ]);

        const rejected = results.filter(result => result.status === 'rejected');
        if (rejected.length > 0) {
            setError('Error loading some dashboard components. Check console for details.');
        }

        setLoading(false);
    };

    useEffect(() => {
        if(token) fetchData();
    }, [token]);


    // --- Campaign Handlers ---
    const handleCampChange = (e) => setCampFormData({ ...campFormData, [e.target.name]: e.target.value });

    const handleCreateCampaign = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        try {
            const response = await axios.post(API_CAMPAIGN, campFormData, { headers });
            setSuccessMessage(response.data.message);
            setCampFormData({ cName: '', goalAmount: '', sDate: '', eDate: '' });
            fetchData();

        } catch (err) {
            console.error('Create error:', err.response?.data);
            setError(err.response?.data?.message || 'Failed to create campaign.');
        }
    };

    // --- Project Handlers ---
    const handleProjChange = (e) => {
        setProjFormData({ ...projFormData, [e.target.name]: e.target.value });
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        const dataToSubmit = {
            pName: projFormData.pName,
            budget: projFormData.budget,
            sDate: projFormData.sDate,
            campId: projFormData.campId || null
        };

        try {
            const response = await axios.post(API_PROJECT, dataToSubmit, { headers });
            setSuccessMessage(response.data.message);
            setProjFormData({
                pName: '',
                budget: '',
                sDate: '',
                campId: campaigns.length > 0 ? campaigns[0].CAMP_ID : ''
            });
            fetchData();

        } catch (err) {
            console.error('Create project error:', err.response?.data);
            setError(err.response?.data?.message || 'Failed to create project.');
        }
    };

    // --- Expense Modal Handlers ---
    const openExpenseModal = (proj) => {
        setExpenseModal({
            isOpen: true,
            projId: proj.PROJ_ID,
            pName: proj.PNAME,
            expenseAmount: ''
        });
    };

    const handleExpenseChange = (e) => {
        setExpenseModal({ ...expenseModal, expenseAmount: e.target.value });
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        const { projId, expenseAmount } = expenseModal;

        if (Number(expenseAmount) <= 0 || !projId) {
            return setError('Please enter a valid expense amount greater than zero.');
        }

        try {
            const response = await axios.patch(
                `${API_PROJECT}/${projId}/expense`,
                { expenseAmount: Number(expenseAmount) },
                { headers }
            );

            setSuccessMessage(response.data.message);
            setExpenseModal({ isOpen: false, projId: null, pName: '', expenseAmount: '' });

            fetchData();

        } catch (err) {
            console.error('Record expense error:', err.response?.data);
            setError(err.response?.data?.message || 'Failed to record expense.');
        }
    };

    // --- Link Campaign Modal Handlers ---
    const openLinkModal = (proj) => {
        setLinkModal({
            isOpen: true,
            projId: proj.PROJ_ID,
            pName: proj.PNAME,
            campId: proj.CAMP_ID || (campaigns.length > 0 ? campaigns[0].CAMP_ID : '')
        });
    };

    const handleLinkChange = (e) => {
        setLinkModal({ ...linkModal, campId: e.target.value });
    };

    const handleSubmitLink = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        const { projId, campId } = linkModal;

        if (!campId || !projId) {
            return setError('Both Project and Campaign ID are required for linking.');
        }

        try {
            const response = await axios.patch(
                `${API_PROJECT}/${projId}/link-campaign`,
                { campId },
                { headers }
            );

            setSuccessMessage(response.data.message);
            setLinkModal({ isOpen: false, projId: null, pName: '', campId: '' });

            fetchData();

        } catch (err) {
            console.error('Link campaign error:', err.response?.data);
            setError(err.response?.data?.message || 'Failed to link project.');
        }
    };

    const getCampaignName = (campId) => {
        const camp = campaigns.find(c => c.CAMP_ID === campId);
        return camp ? camp.C_NAME : 'N/A';
    };
    
    // Summary calculation for the cards
    const totalRaised = campaignSummary.reduce((sum, camp) => sum + (camp.TOTAL_RAISED || 0), 0);
    const activeProjects = projects.filter(p => p.SPENT < p.BUDGET || p.SPENT === null).length; // Simple active check

    if (loading) return <div className="loading">Loading Staff Dashboard...</div>;

    return (
        <div className="dashboard-container">
            {/* --- WELCOME MESSAGE & LOGOUT --- */}
            <h1 className="text-center" style={{ marginBottom: '10px' }}>
                <span style={{ color: 'var(--primary-color)' }}>🛠️ Staff Management Dashboard</span>
            </h1>
            <p className="text-center" style={{ marginBottom: '40px', color: '#666' }}>
                Logged in as: <strong>{user.primaryId} ({user.userType})</strong>
                <button onClick={logout} className="btn btn-danger btn-small" style={{ marginLeft: '20px' }}>Logout</button>
            </p>

            {/* --- DASHBOARD SUMMARY CARDS --- */}
            <div className="card-grid">
                <div className="card-box card-primary">
                    <p>Total Campaigns</p>
                    <h3>{campaigns.length}</h3>
                </div>
                <div className="card-box card-secondary">
                    <p>Total Funds Raised</p>
                    <h3>{formatCurrency(totalRaised)}</h3>
                </div>
                <div className="card-box card-success">
                    <p>Active Projects</p>
                    <h3>{activeProjects}</h3>
                </div>
                <div className="card-box card-info">
                    <p>Registered Donors</p>
                    <h3>{donorSummary.length}</h3>
                </div>
            </div>
            
            <hr />

            {successMessage && <p className="message-success text-center">{successMessage}</p>}
            {error && <p className="message-error text-center">{error}</p>}

            {/* --- CAMPAIGN MANAGEMENT PANEL --- */}
            <h2 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginTop: '40px' }}>Campaign Management</h2>

            {/* Create Campaign Form */}
            <div className="form-panel card-box card-primary-light grid-2">
                <h3 className="text-center">Create New Campaign</h3>
                <form onSubmit={handleCreateCampaign}>
                    <div className="form-group"><label>Name</label><input type="text" name="cName" value={campFormData.cName} onChange={handleCampChange} required /></div>
                    <div className="form-group"><label>Goal (₹)</label><input type="number" name="goalAmount" value={campFormData.goalAmount} onChange={handleCampChange} required min="1"/></div>
                    <div className="form-group"><label>Start Date</label><input type="date" name="sDate" value={campFormData.sDate} onChange={handleCampChange} required /></div>
                    <div className="form-group"><label>End Date</label><input type="date" name="eDate" value={campFormData.eDate} onChange={handleCampChange} required /></div>
                    <button type="submit" className="btn btn-primary" style={{marginTop: '15px'}}>Create Campaign</button>
                </form>
            </div>

            {/* Campaign Financial Summary Table */}
            <h3 style={{ textAlign: 'center', marginTop: '40px' }}>Campaign Financial Summary ({campaignSummary.length})</h3>
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Goal</th>
                            <th>Raised</th>
                            <th>% Met</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaignSummary.map((camp) => (
                            <tr key={camp.CAMP_ID}>
                                <td>{camp.C_NAME}</td>
                                <td>{formatCurrency(camp.GOAL_AMOUNT)}</td>
                                <td style={{ fontWeight: 'bold', color: camp.TOTAL_RAISED >= camp.GOAL_AMOUNT ? 'var(--success-color)' : 'inherit' }}>
                                    {formatCurrency(camp.TOTAL_RAISED)}
                                </td>
                                <td>
                                    {/* Progress Bar Display */}
                                    <div className="progress-bar-container">
                                        <div
                                            style={{
                                                width: `${Math.min(100, camp.PERCENT_MET)}%`,
                                                backgroundColor: camp.PERCENT_MET >= 100 ? 'var(--primary-color)' : 'var(--secondary-color)'
                                            }}
                                            className="progress-bar-fill"
                                        >
                                            {camp.PERCENT_MET}%
                                        </div>
                                    </div>
                                </td>
                                <td>{camp.STATUS}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <hr style={{ marginTop: '50px' }}/>

            {/* --- PROJECT MANAGEMENT PANEL --- */}
            <h2 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginTop: '40px' }}>Project Management</h2>

            {/* Create Project Form */}
            <div className="form-panel card-box card-success-light grid-2">
                <h3 className="text-center">Create New Project</h3>
                <form onSubmit={handleCreateProject}>
                    <div className="form-group"><label>Name</label><input type="text" name="pName" value={projFormData.pName} onChange={handleProjChange} required /></div>
                    <div className="form-group"><label>Budget (₹)</label><input type="number" name="budget" value={projFormData.budget} onChange={handleProjChange} required min="1" /></div>
                    <div className="form-group"><label>Start Date</label><input type="date" name="sDate" value={projFormData.sDate} onChange={handleProjChange} required /></div>

                    {/* Campaign Selector */}
                    <div className="form-group">
                        <label htmlFor="campId">Link to Campaign (Optional):</label>
                        <select
                            id="campId"
                            name="campId"
                            value={projFormData.campId}
                            onChange={handleProjChange}
                        >
                            <option value="">-- Unlinked --</option>
                            {campaigns.map(camp => (
                                <option key={camp.CAMP_ID} value={camp.CAMP_ID}>
                                    {camp.C_NAME} (ID: {camp.CAMP_ID})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button type="submit" className="btn btn-success" style={{marginTop: '15px'}}>Create Project</button>
                </form>
            </div>

            {/* Project List Table */}
            <h3 style={{ textAlign: 'center', marginTop: '40px' }}>Project List ({projects.length})</h3>
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Budget</th>
                            <th>Spent</th>
                            <th>Linked Campaign</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map((proj) => (
                            <tr key={proj.PROJ_ID}>
                                <td>{proj.PROJ_ID}</td>
                                <td>{proj.PNAME}</td>
                                <td>{formatCurrency(proj.BUDGET)}</td>
                                <td style={{ fontWeight: 'bold' }}>{formatCurrency(proj.SPENT)}</td>
                                <td>
                                    {proj.CAMP_ID ? getCampaignName(proj.CAMP_ID) : '— Unlinked —'}
                                </td>
                                <td>
                                    <div className="action-buttons-group">
                                        <button
                                            onClick={() => openExpenseModal(proj)}
                                            className="btn btn-small btn-info"
                                        >
                                            Expense
                                        </button>
                                        <button
                                            onClick={() => openLinkModal(proj)}
                                            className="btn btn-small btn-secondary"
                                        >
                                            {proj.CAMP_ID ? 'Change Link' : 'Link'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <hr style={{ marginTop: '50px' }}/>

            {/* --- DONOR MANAGEMENT PANEL --- */}
            <h2 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginTop: '40px' }}>Donor Management</h2>
            <h3 style={{ textAlign: 'center', marginTop: '20px' }}>Registered Donors & Lifetime Giving ({donorSummary.length})</h3>

            <div className="table-responsive">
                {donorSummary.length === 0 ? (
                    <p className="text-center">No donor accounts found.</p>
                ) : (
                    <table className="data-table donor-table">
                        <thead>
                            <tr>
                                <th>Donor Name</th>
                                <th>Email</th>
                                <th>Aadhar No.</th>
                                <th>Total Given</th>
                            </tr>
                        </thead>
                        <tbody>
                            {donorSummary.map((donor) => (
                                <tr key={donor.DONOR_ID}>
                                    <td>
                                        {donor.FNAME} {donor.LNAME}
                                    </td>
                                    <td>
                                        {donor.EMAIL}
                                    </td>
                                    <td>
                                        {donor.AADHAR_NO}
                                    </td>
                                    <td style={{ fontWeight: 'bold' }}>
                                        {formatCurrency(donor.TOTAL_GIVEN)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* --- Expense Tracking Modal --- */}
            {expenseModal.isOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 className="text-center">Record Expense for: {expenseModal.pName}</h3>
                        <form onSubmit={handleSubmitExpense}>
                            <div className="form-group" style={{ textAlign: 'left' }}>
                                <label htmlFor="expenseAmount">Expense Amount (₹):</label>
                                <input
                                    id="expenseAmount"
                                    type="number"
                                    name="expenseAmount"
                                    value={expenseModal.expenseAmount}
                                    onChange={handleExpenseChange}
                                    required
                                    min="1"
                                    step="0.01"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn btn-primary">
                                    Record Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpenseModal({ isOpen: false, projId: null, pName: '', expenseAmount: '' })}
                                    className="btn btn-danger"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Link Campaign Modal --- */}
            {linkModal.isOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 className="text-center">Link Project: {linkModal.pName}</h3>
                        <form onSubmit={handleSubmitLink}>
                            <div className="form-group" style={{ textAlign: 'left' }}>
                                <label htmlFor="linkCampId">Select Campaign to Link:</label>
                                <select
                                    id="linkCampId"
                                    name="linkCampId"
                                    value={linkModal.campId}
                                    onChange={handleLinkChange}
                                    required
                                >
                                    {campaigns.map(camp => (
                                        <option key={camp.CAMP_ID} value={camp.CAMP_ID}>
                                            {camp.C_NAME} (ID: {camp.CAMP_ID})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn btn-primary">
                                    Finalize Link
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLinkModal({ isOpen: false, projId: null, pName: '', campId: '' })}
                                    className="btn btn-danger"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

// Inline styles for the modal (kept for functionality, usually moved to CSS)
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
};

const modalContentStyle = {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    color: '#333',
    textAlign: 'center'
};


export default StaffDashboard;