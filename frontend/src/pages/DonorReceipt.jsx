// src/pages/DonorReceipt.jsx (NEW FILE)

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2pdf from 'html2pdf.js'; // ⬅️ IMPORT LIBRARY
import { useAuth } from '../context/AuthContext';
import '../App.css';

const API_DONATIONS = 'http://localhost:3000/api/donations';

function DonorReceipt() {
    const { donId } = useParams(); // Get the donation ID from the URL
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [receiptData, setReceiptData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const receiptRef = useRef(); // Ref to the component we want to convert to PDF

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };
    
    // --- Fetch Receipt Data ---
    const fetchReceiptData = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axios.get(`${API_DONATIONS}/${donId}`, { headers });
            setReceiptData(response.data.donation);
        } catch (err) {
            console.error('Fetch receipt error:', err.response?.data || err);
            setError(err.response?.data?.message || 'Failed to load receipt data.');
            if (err.response?.status === 403) {
                 setTimeout(() => navigate('/dashboard/donor'), 3000); // Redirect if forbidden
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (donId && token) {
            fetchReceiptData();
        }
    }, [donId, token]);

    // --- PDF Generation Handler ---
    const generatePdf = () => {
        if (!receiptData) return;
        
        const options = {
            margin: [10, 10, 10, 10], // top, left, bottom, right
            filename: `Receipt_${receiptData.D_ID}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const element = receiptRef.current;
        html2pdf().from(element).set(options).save();
    };

    if (loading) return <div className="container text-center" style={{paddingTop: '100px'}}><h2>Loading Receipt...</h2></div>;
    
    if (error || !receiptData) {
        return (
            <div className="container text-center" style={{paddingTop: '50px'}}>
                <h2>Error Loading Receipt</h2>
                <p style={{color: 'red'}}>{error}</p>
                <button onClick={() => navigate(-1)} className="btn btn-primary">Go Back</button>
            </div>
        );
    }

    // Receipt details for display
    const { D_ID, DONOR_NAME, DONOR_EMAIL, CAMPAIGN_NAME, AMOUNT, DONATION_DATE, PAYMENT_METHOD } = receiptData;

    return (
        <div className="container" style={{maxWidth: '800px', margin: 'auto', padding: '20px'}}>
            <h1 className="text-center">Donation Receipt</h1>
            <div className="text-center" style={{marginBottom: '20px'}}>
                <button onClick={generatePdf} className="btn btn-success" style={{marginRight: '10px'}}>
                    Download PDF Receipt
                </button>
                <button onClick={() => navigate('/dashboard/donor')} className="btn btn-secondary">
                    Back to Dashboard
                </button>
            </div>

            {/* Receipt Content Box - This is the element that gets converted to PDF */}
            <div ref={receiptRef} style={receiptBoxStyle}>
                <div style={headerStyle}>
                    <h2>[Your Charity Name]</h2>
                    <p>Official Donation Receipt</p>
                </div>
                
                <div style={infoSectionStyle}>
                    <p><strong>Receipt Number:</strong> {D_ID}</p>
                    <p><strong>Donation Date:</strong> {formatDate(DONATION_DATE)}</p>
                </div>

                <div style={infoSectionStyle}>
                    <h3>Donor Information</h3>
                    <p><strong>Name:</strong> {DONOR_NAME}</p>
                    <p><strong>Email:</strong> {DONOR_EMAIL}</p>
                    <p><strong>Donor ID:</strong> {receiptData.DONOR_ID}</p>
                </div>

                <div style={infoSectionStyle}>
                    <h3>Donation Details</h3>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={{backgroundColor: '#e0f7fa'}}>
                                <th style={thStyle}>Campaign</th>
                                <th style={thStyle}>Method</th>
                                <th style={thStyle}>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={tdStyle}>{CAMPAIGN_NAME}</td>
                                <td style={tdStyle}>{PAYMENT_METHOD}</td>
                                <td style={{...tdStyle, fontWeight: 'bold'}}>{AMOUNT?.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td colSpan="2" style={{...tdStyle, textAlign: 'right', fontWeight: 'bold'}}>TOTAL DONATION:</td>
                                <td style={{...tdStyle, fontWeight: 'bold', fontSize: '1.2em'}}>₹{AMOUNT?.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style={footerStyle}>
                    <p>This is an official receipt for income tax purposes.</p>
                    <p>Thank you for your generous support!</p>
                </div>
            </div>
        </div>
    );
}

// Inline Styles for the Receipt (Improves PDF generation fidelity)
const receiptBoxStyle = {
    padding: '30px',
    border: '1px solid #ccc',
    backgroundColor: '#fff',
    color: '#000',
    fontFamily: 'Arial, sans-serif',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)'
};

const headerStyle = {
    textAlign: 'center',
    borderBottom: '2px solid #007bff',
    paddingBottom: '10px',
    marginBottom: '20px'
};

const infoSectionStyle = {
    marginBottom: '25px',
    padding: '10px',
    border: '1px solid #eee',
    borderRadius: '5px'
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px'
};

const thStyle = {
    border: '1px solid #ccc',
    padding: '10px',
    textAlign: 'left',
    backgroundColor: '#f5f5f5'
};

const tdStyle = {
    border: '1px solid #ccc',
    padding: '10px',
    textAlign: 'left'
};

const footerStyle = {
    textAlign: 'center',
    marginTop: '40px',
    paddingTop: '15px',
    borderTop: '1px solid #ccc',
    fontSize: '0.9em',
    color: '#555'
};


export default DonorReceipt;