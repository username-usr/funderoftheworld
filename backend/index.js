// index.js (or server.js)

const express = require('express');
const oracledb = require('oracledb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// --- Configuration Files ---
// NOTE: Ensure you have a 'dbConfig.js' file in this directory with your Oracle credentials.
const dbConfig = require('./dbConfig');

// --- CONSTANTS ---
const app = express();
const PORT = 3000;
// ⚠️ CHANGE THIS: Use a secure, random string for production
const JWT_SECRET = 'YOUR_SUPER_SECRET_KEY'; 

// --- MIDDLEWARE ---
app.use(express.json()); // Allows Express to read JSON body data from requests
app.use(cors({
    origin: 'http://localhost:5173', // Must match your React frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// Set the output format for query results to JavaScript objects
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// --- DATABASE SETUP ---

// Enable Thick mode for older database versions (like XE)
try {
  oracledb.initOracleClient();
  console.log('Using node-oracledb Thick mode.');
} catch (err) {
  console.error('Error initializing Oracle Client (Thick Mode):', err);
  process.exit(1); // Exit if client fails to initialize
}

async function initializeDatabase() {
  try {
    // Create the connection pool
    await oracledb.createPool(dbConfig);
    console.log('✅ Oracle Database Connection Pool initialized successfully!');
  } catch (err) {
    console.error('❌ Error initializing database pool:', err);
    process.exit(1);
  }
}

// --- UTILITY FUNCTION: Generates a unique ID ---
function generateUniqueId(prefix) {
    return prefix + '_' + Date.now();
}

// --- AUTHORIZATION MIDDLEWARE ---

/**
 * Middleware function to verify the JWT token
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects format: Bearer <token>

    if (token == null) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden (Token invalid or expired)
        req.user = user; // Attach user payload (userId, primaryId, userType) to the request
        next();
    });
};

/**
 * Middleware to restrict access to only STAFF users
 */
const authorizeStaff = (req, res, next) => {
    if (req.user && req.user.userType === 'STAFF') {
        next(); 
    } else {
        res.status(403).json({ message: 'Access denied. Staff role required.' }); 
    }
};

const authorizeDonor = (req, res, next) => {
    // Check if the user is authenticated AND has the DONOR role
    if (req.user && req.user.userType === 'DONOR') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Donor role required.' });
    }
};

// --- AUTHENTICATION ROUTES ---

/**
 * POST: Endpoint for new user registration (Staff or Donor).
 * Includes robust validation for Aadhar, email, and password.
 */
app.post('/api/auth/signup', async (req, res) => {
    let connection;
    try {
        // Destructuring with null defaults to handle missing but nullable fields
        const { 
            aadharNo, 
            password, 
            email, 
            userType, 
            fname = null, 
            lname = null,
        } = req.body;

        // 1. INPUT VALIDATION
        if (!email || !password || !aadharNo || !userType) {
            return res.status(400).json({ message: 'Missing required fields: email, password, Aadhar number, and user type.' });
        }

        const upperUserType = userType.toUpperCase();
        if (upperUserType !== 'STAFF' && upperUserType !== 'DONOR') {
            return res.status(400).json({ message: 'Invalid user type. Must be STAFF or DONOR.' });
        }

        // Validate Aadhar Number (exactly 12 digits)
        if (!/^\d{12}$/.test(aadharNo)) {
             return res.status(400).json({ message: 'Invalid Aadhar number. Must be exactly 12 digits.' });
        }
        
        // Basic Email Validation
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format.' });
        }
        
        // Password length check (example)
        if (password.length < 6) {
             return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }
        
        // 2. Hash the password and generate IDs
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateUniqueId(upperUserType);
        const primaryId = generateUniqueId(upperUserType.slice(0, 1)); 

        connection = await oracledb.getConnection();
        
        // 3. Insert into NEW_CREDENTIALS 
        const credSql = `
            INSERT INTO NEW_CREDENTIALS 
            (USER_ID, AADHAR_NO, PASSWORD, EMAIL, USER_TYPE)
            VALUES (:userId, :aadharNo, :hashedPassword, :email, :userType)`;
        
        // NOTE: Transactions (BEGIN/COMMIT) removed for debugging, using autoCommit: true
        await connection.execute(credSql, { 
            userId, aadharNo, hashedPassword, email, userType: upperUserType
        }, { autoCommit: true });

        // 4. Insert into STAFF or DONOR table 
        if (upperUserType === 'STAFF') {
            const staffSql = `
                INSERT INTO STAFF 
                (STAFF_ID, USER_ID, FNAME, LNAME, DOJ)
                VALUES (:primaryId, :userId, :fname, :lname, :doj)`;
            
            const staffBinds = { primaryId, userId, fname, lname, doj: new Date()};
            await connection.execute(staffSql, staffBinds, { autoCommit: true });

        } else if (upperUserType === 'DONOR') {
            const donorSql = `
                INSERT INTO DONOR 
                (DONOR_ID, USER_ID, FNAME, LNAME)
                VALUES (:primaryId, :userId, :fname, :lname)`;
                
            const donorBinds = { primaryId, userId, fname, lname};
            await connection.execute(donorSql, donorBinds, { autoCommit: true });
        }
        
        res.status(201).json({ 
            message: 'User registered successfully!', 
            userId: primaryId, 
            userType: upperUserType 
        });

    } catch (err) {
        console.error('Signup Error:', err);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error('Rollback Error:', rbErr);
            }
        }
        // ORA-00001: unique constraint violated
        if (err.errorNum === 1) { 
             return res.status(409).json({ message: 'This email or Aadhar number is already registered.' });
        }
        res.status(500).json({ message: 'Internal server error during registration.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});


/**
 * POST: Endpoint for user login.
 */
app.post('/api/auth/login', async (req, res) => {
    let connection;
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        connection = await oracledb.getConnection();

        // 1. Retrieve the user's credentials and userType
        const sql = `
            SELECT USER_ID, PASSWORD, USER_TYPE 
            FROM NEW_CREDENTIALS 
            WHERE EMAIL = :email`;
        
        const result = await connection.execute(sql, { email });

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Authentication failed. User not found.' });
        }

        const user = result.rows[0];

        // 2. Compare the provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.PASSWORD);

        if (!isMatch) {
            return res.status(401).json({ message: 'Authentication failed. Incorrect password.' });
        }

        // 3. Find the primary ID (STAFF_ID or DONOR_ID)
        let primaryId = null;
        if (user.USER_TYPE === 'STAFF') {
            const staffResult = await connection.execute(
                `SELECT STAFF_ID FROM STAFF WHERE USER_ID = :userId`,
                { userId: user.USER_ID }
            );
            primaryId = staffResult.rows[0]?.STAFF_ID;
        } else if (user.USER_TYPE === 'DONOR') {
            const donorResult = await connection.execute(
                `SELECT DONOR_ID FROM DONOR WHERE USER_ID = :userId`,
                { userId: user.USER_ID }
            );
            primaryId = donorResult.rows[0]?.DONOR_ID;
        }
        
        if (!primaryId) {
             return res.status(500).json({ message: 'User profile not found after login.' });
        }

        // 4. Generate JWT Token
        const token = jwt.sign(
            { userId: user.USER_ID, primaryId: primaryId, userType: user.USER_TYPE }, 
            JWT_SECRET, 
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.status(200).json({
            message: 'Login successful!',
            token,
            userType: user.USER_TYPE,
            primaryId: primaryId 
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Internal server error during login.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});


// Example protected route: requires a valid token
app.get('/api/profile', authenticateToken, async (req, res) => {
    res.json({
        message: `Welcome, ${req.user.userType}!`,
        user: req.user
    });
});

// --- CAMPAIGN MANAGEMENT ROUTES (Requires Staff Access) ---
/**
 * GET: Retrieve a list of all campaigns.
 */
app.get('/api/campaigns', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        // Retrieve all necessary campaign details
        const sql = `
            SELECT CAMP_ID, C_NAME, STATUS, SDATE, EDATE, GOAL_AMOUNT
            FROM CAMPAIGN
            ORDER BY SDATE DESC`;
        
        const result = await connection.execute(sql);

        res.status(200).json({
            count: result.rows.length,
            campaigns: result.rows 
        });
    } catch (err) {
        console.error('Error fetching campaigns:', err);
        res.status(500).json({ message: 'Failed to retrieve campaign data.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * GET: Retrieve total raised amount for all campaigns.
 */
app.get('/api/campaigns/summary', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        // SQL to join CAMPAIGN with DONATION and calculate the SUM of AMOUNT
        const sql = `
            SELECT 
                C.CAMP_ID,
                C.C_NAME,
                C.GOAL_AMOUNT,
                C.STATUS,
                NVL(SUM(D.AMOUNT), 0) AS TOTAL_RAISED
            FROM CAMPAIGN C
            LEFT JOIN DONATION D ON C.CAMP_ID = D.CAMP_ID
            GROUP BY C.CAMP_ID, C.C_NAME, C.GOAL_AMOUNT, C.STATUS
            ORDER BY C.C_NAME`;
        
        const result = await connection.execute(sql);

        res.status(200).json({
            summary: result.rows
        });
    } catch (err) {
        console.error('Error fetching campaign summary:', err);
        res.status(500).json({ message: 'Failed to retrieve campaign summary data.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * GET: Retrieve financial summary for all campaigns (total raised vs. goal).
 * Requires Staff access.
 */
app.get('/api/campaigns/financial-summary', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        // SQL to join CAMPAIGN with DONATION and calculate the SUM of AMOUNT
        const sql = `
            SELECT 
                C.CAMP_ID,
                C.C_NAME,
                C.GOAL_AMOUNT,
                C.STATUS,
                NVL(SUM(D.AMOUNT), 0) AS TOTAL_RAISED
            FROM CAMPAIGN C
            LEFT JOIN DONATION D ON C.CAMP_ID = D.CAMP_ID
            GROUP BY C.CAMP_ID, C.C_NAME, C.GOAL_AMOUNT, C.STATUS
            ORDER BY C.STATUS, C.C_NAME`;
        
        const result = await connection.execute(sql);

        // Calculate percentage met on the server side
        const summary = result.rows.map(row => ({
            ...row,
            // Calculate percentage, handling division by zero/null explicitly
            PERCENT_MET: row.GOAL_AMOUNT > 0 ? 
                            parseFloat(((row.TOTAL_RAISED / row.GOAL_AMOUNT) * 100).toFixed(2)) : 
                            0
        }));

        res.status(200).json({
            summary: summary
        });
    } catch (err) {
        console.error('Error fetching campaign financial summary:', err);
        res.status(500).json({ message: 'Failed to retrieve campaign financial summary.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});


/**
 * POST: Create a new campaign.
 */
app.post('/api/campaigns', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        const { cName, goalAmount, sDate, eDate } = req.body;
        const managerStaffId = req.user.primaryId; 

        if (!cName || !goalAmount || !sDate || !eDate) {
            return res.status(400).json({ message: 'Missing required fields: Campaign Name, Goal Amount, Start Date, and End Date.' });
        }
        
        const campId = generateUniqueId('CAMP');

        connection = await oracledb.getConnection();
        
        const sql = `
            INSERT INTO CAMPAIGN (CAMP_ID, C_NAME, STATUS, SDATE, EDATE, GOAL_AMOUNT, MANAGER_STAFF_ID)
            VALUES (:campId, :cName, 'ACTIVE', TO_DATE(:sDate, 'YYYY-MM-DD'), 
                    TO_DATE(:eDate, 'YYYY-MM-DD'), :goalAmount, :managerStaffId)`;
        
        const binds = {
            campId, cName, goalAmount, managerStaffId, 
            sDate, 
            eDate: eDate 
        };

        await connection.execute(sql, binds, { autoCommit: true });

        res.status(201).json({ 
            message: 'Campaign created successfully!', 
            campId 
        });

    } catch (err) {
        console.error('Error creating campaign:', err);
        if (err.errorNum === 1) { 
             return res.status(409).json({ message: 'A campaign with this name may already exist.' });
        }
        res.status(500).json({ message: 'Internal server error while creating campaign.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * PUT/PATCH: Update the status of a specific campaign.
 */
app.patch('/api/campaigns/:campId/status', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        const { campId } = req.params;
        const { status } = req.body;
        const staffId = req.user.primaryId;

        if (!status) {
            return res.status(400).json({ message: 'Missing required field: status.' });
        }

        const validStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED'];
        const upperStatus = status.toUpperCase();
        if (!validStatuses.includes(upperStatus)) {
            return res.status(400).json({ message: 'Invalid status provided.' });
        }
        
        connection = await oracledb.getConnection();
        
        // Ensure the staff member manages this campaign (Optional, but good security)
        // You might skip this for now if you want any staff member to manage any campaign.
        /*
        const managerCheck = await connection.execute(
            `SELECT 1 FROM CAMPAIGN WHERE CAMP_ID = :campId AND MANAGER_STAFF_ID = :staffId`,
            { campId, staffId }
        );
        if (managerCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied. You do not manage this campaign.' });
        }
        */

        const sql = `
            UPDATE CAMPAIGN 
            SET STATUS = :upperStatus 
            WHERE CAMP_ID = :campId`;
        
        const binds = { upperStatus, campId };

        const result = await connection.execute(sql, binds, { autoCommit: true });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }

        res.status(200).json({ 
            message: `Campaign ${campId} status updated to ${upperStatus} successfully!`
        });

    } catch (err) {
        console.error('Error updating campaign status:', err);
        res.status(500).json({ message: 'Internal server error while updating campaign status.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// --- PUBLIC/DONOR CAMPAIGN VIEW (Requires Login, not necessarily Staff) ---
// GET: Fetch all active campaigns (used by Donor Dashboard)
app.get('/api/campaigns/active', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        // Only fetch ACTIVE campaigns for the public view
        const sql = `
            SELECT CAMP_ID, C_NAME, GOAL_AMOUNT, SDATE, EDATE
            FROM CAMPAIGN
            WHERE STATUS = 'ACTIVE'
            ORDER BY SDATE DESC`;
        
        const result = await connection.execute(sql);
        res.status(200).json({ campaigns: result.rows });
    } catch (err) {
        console.error('Error fetching active campaigns:', err);
        res.status(500).json({ message: 'Failed to retrieve active campaigns.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
});

// index.js (CORRECTED app.post('/api/donations') route)

/**
 * POST: Record a new donation (Requires Donor Access).
 */
app.post('/api/donations', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { campId, amount } = req.body;
        const donorId = req.user.primaryId;   // Get the DONOR_ID (e.g., D_1700...)

        // Authorization and validation checks
        if (req.user.userType !== 'DONOR') {
            return res.status(403).json({ message: 'Access denied. Only Donor accounts can make donations.' });
        }

        if (!campId || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Missing or invalid fields: campId and positive amount are required.' });
        }
        
        // Use D_ID based on your schema
        const donId = generateUniqueId('D'); 
        
        connection = await oracledb.getConnection();
        
        // Campaign status check (optional but good practice)
        const campCheck = await connection.execute(
            `SELECT STATUS FROM CAMPAIGN WHERE CAMP_ID = :campId`,
            { campId }
        );

        if (campCheck.rows.length === 0 || campCheck.rows[0].STATUS !== 'ACTIVE') {
            return res.status(404).json({ message: 'Campaign not found or not currently active.' });
        }

        // --- SQL FIX: Using the correct columns and passing the date ---
        // Assuming you ran the ALTER TABLE command above to add DONATION_DATE
        const sql = `
            INSERT INTO DONATION (D_ID, DONOR_ID, CAMP_ID, AMOUNT, PAYMENT_METHOD, DONATION_DATE)
            VALUES (:donId, :donorId, :campId, :amount, 'ONLINE', :donationDate)`;
        
        const binds = {
            donId, 
            donorId, 
            campId, 
            amount,
            // Pass the current date from Node.js, which node-oracledb handles
            donationDate: new Date() 
        };
        // -------------------------------------------------------------------------------

        await connection.execute(sql, binds, { autoCommit: true });

        res.status(201).json({ 
            message: 'Donation of ₹' + amount + ' recorded successfully!', 
            donId 
        });

    } catch (err) {
        console.error('Error creating donation:', err);
        res.status(500).json({ message: 'Internal server error while recording donation.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * GET: Retrieve donation history.
 * Staff get all donations. Donors get only their own.
 */
app.get('/api/donations/history', authenticateToken, async (req, res) => {
    let connection;
    try {
        const userType = req.user.userType;
        const donorId = req.user.primaryId; // This is the DONOR_ID

        connection = await oracledb.getConnection();
        
        // Base SQL query to join Donation and Campaign tables
        let sql = `
            SELECT 
                D.D_ID, 
                D.DONOR_ID, 
                D.AMOUNT, 
                D.DONATION_DATE, 
                D.PAYMENT_METHOD,
                C.C_NAME AS CAMPAIGN_NAME
            FROM DONATION D
            JOIN CAMPAIGN C ON D.CAMP_ID = C.CAMP_ID
        `;
        
        let binds = {};

        // If the user is a Donor, filter the results
        if (userType === 'DONOR') {
            sql += ` WHERE D.DONOR_ID = :donorId`;
            binds = { donorId };
        }
        
        sql += ` ORDER BY D.DONATION_DATE DESC`;

        const result = await connection.execute(sql, binds);

        res.status(200).json({
            history: result.rows
        });
    } catch (err) {
        console.error('Error fetching donation history:', err);
        res.status(500).json({ message: 'Failed to retrieve donation history.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * GET: Retrieve detailed data for a single donation receipt by ID.
 * Requires authentication and checks if the user owns the donation (if Donor).
 */
app.get('/api/donations/:donId', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { donId } = req.params;
        const userType = req.user.userType;
        const primaryId = req.user.primaryId; // DONOR_ID or STAFF_ID

        connection = await oracledb.getConnection();
        
        // Corrected SQL Query: Using NEW_CREDENTIALS instead of APP_USER
        let sql = `
            SELECT 
                D.D_ID, 
                D.DONOR_ID, 
                D.AMOUNT, 
                D.DONATION_DATE, 
                D.PAYMENT_METHOD,
                C.C_NAME AS CAMPAIGN_NAME,
                R.FNAME || ' ' || R.LNAME AS DONOR_NAME,  -- Get name from DONOR table
                U.EMAIL AS DONOR_EMAIL                     -- Get email from NEW_CREDENTIALS table
            FROM DONATION D
            JOIN CAMPAIGN C ON D.CAMP_ID = C.CAMP_ID
            JOIN DONOR R ON D.DONOR_ID = R.DONOR_ID
            JOIN NEW_CREDENTIALS U ON R.USER_ID = U.USER_ID  -- ⬅️ CORRECTED TABLE NAME
            WHERE D.D_ID = :donId
        `;
        
        let binds = { donId };

        const result = await connection.execute(sql, binds);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Donation not found.' });
        }

        const donation = result.rows[0];

        // Security check: Donors can only view their own receipts. Staff can view all.
        if (userType === 'DONOR' && donation.DONOR_ID !== primaryId) {
            return res.status(403).json({ message: 'Access denied. You do not own this receipt.' });
        }
        
        res.status(200).json({ donation });

    } catch (err) {
        console.error('Error fetching single donation data:', err);
        res.status(500).json({ message: 'Failed to retrieve donation receipt data.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * GET: Retrieve a list of all donors and their total lifetime donation amount.
 * Requires Staff access.
 */
app.get('/api/donors/summary', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        // SQL to join DONOR, NEW_CREDENTIALS, and aggregate donations from DONATION table
        const sql = `
            SELECT 
                D.DONOR_ID,
                D.FNAME,
                D.LNAME,
                U.EMAIL,
                U.AADHAR_NO,
                NVL(SUM(T.AMOUNT), 0) AS TOTAL_GIVEN
            FROM DONOR D
            JOIN NEW_CREDENTIALS U ON D.USER_ID = U.USER_ID
            LEFT JOIN DONATION T ON D.DONOR_ID = T.DONOR_ID
            GROUP BY D.DONOR_ID, D.FNAME, D.LNAME, U.EMAIL, U.AADHAR_NO
            ORDER BY TOTAL_GIVEN DESC`;
        
        const result = await connection.execute(sql);

        res.status(200).json({
            donors: result.rows
        });
    } catch (err) {
        console.error('Error fetching donor summary:', err);
        res.status(500).json({ message: 'Failed to retrieve donor summary data.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * PATCH: Update the SPENT amount for a specific project.
 * * --- THIS ROUTE IS NOW CORRECTED ---
 * It now blocks expenses that exceed the project's total budget.
 */
app.patch('/api/projects/:projId/expense', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        const { projId } = req.params;
        const { expenseAmount } = req.body; // The amount to ADD to SPENT

        if (expenseAmount == null || isNaN(Number(expenseAmount)) || Number(expenseAmount) <= 0) {
            return res.status(400).json({ message: 'Invalid expense amount provided.' });
        }
        
        const amountToAdd = Number(expenseAmount);

        connection = await oracledb.getConnection();
        
        // 1. Retrieve current project details (BUDGET and SPENT)
        const checkSql = `
            SELECT BUDGET, SPENT, PNAME 
            FROM PROJECT 
            WHERE PROJ_ID = :projId`;
        
        const checkResult = await connection.execute(checkSql, { projId });
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        
        const project = checkResult.rows[0];
        const newSpent = project.SPENT + amountToAdd;

        // 2. Budget Check (ENFORCED)
        // This is the modified block. It now returns a 400 error if
        // the new total spent would exceed the total budget.
        if (newSpent > project.BUDGET) {
            const remainingBudget = project.BUDGET - project.SPENT;
            
            // Return an error and STOP execution
            return res.status(400).json({ 
                message: `Expense blocked. This project's budget is ₹${project.BUDGET.toLocaleString()}. 
                          It has ₹${remainingBudget.toLocaleString()} remaining. 
                          Your expense of ₹${amountToAdd.toLocaleString()} would exceed the limit.`
            });
        }
        
        // 3. Update the SPENT amount (This code is only reached if the check above passes)
        const updateSql = `
            UPDATE PROJECT 
            SET SPENT = :newSpent
            WHERE PROJ_ID = :projId`;
        
        const updateBinds = { newSpent, projId };

        await connection.execute(updateSql, updateBinds, { autoCommit: true });

        res.status(200).json({ 
            message: `Expense of ₹${amountToAdd.toLocaleString()} successfully added to project '${project.PNAME}'.`,
            newSpentTotal: newSpent
        });

    } catch (err) {
        console.error('Error recording project expense:', err);
        res.status(500).json({ message: 'Internal server error while recording expense.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// --- PROJECT MANAGEMENT ROUTES (Requires Staff Access) ---
/**
 * GET: Retrieve a list of all projects.
 */
app.get('/api/projects', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        const sql = `
            SELECT PROJ_ID, PNAME, BUDGET, SPENT, STATUS, SDATE, CAMP_ID
            FROM PROJECT
            ORDER BY SDATE DESC`;
        
        const result = await connection.execute(sql);

        res.status(200).json({
            count: result.rows.length,
            projects: result.rows
        });
    } catch (err) {
        console.error('Error fetching projects:', err);
        res.status(500).json({ message: 'Failed to retrieve project data.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});


/**
 * POST: Create a new project. Staff only.
 */
app.post('/api/projects', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        const { pName, budget, sDate, campId } = req.body; // <-- campId added
        const overseerStaffId = req.user.primaryId;

        if (!pName || !budget || !sDate) {
            return res.status(400).json({ message: 'Project Name, Budget, and Start Date are required.' });
        }

        const projId = generateUniqueId('PROJ');

        connection = await oracledb.getConnection();
        
        // Updated SQL to include CAMP_ID
        const sql = `
            INSERT INTO PROJECT (PROJ_ID, PNAME, BUDGET, SPENT, STATUS, SDATE, OVERSEER_STAFF_ID, CAMP_ID)
            VALUES (:projId, :pName, :budget, 0, 'ONGOING', TO_DATE(:sDate, 'YYYY-MM-DD'), :overseerStaffId, :campId)`;
        
        const binds = {
            projId, pName, budget: Number(budget), overseerStaffId, sDate, campId: campId || null // Set to null if not provided
        };

        await connection.execute(sql, binds, { autoCommit: true });

        res.status(201).json({ 
            message: `Project created successfully${campId ? ' and linked to Campaign ' + campId : ''}!`, 
            projId 
        });

    } catch (err) {
        console.error('Error creating project:', err);
        // ORA-02291 is foreign key constraint violation (invalid CAMP_ID)
        if (err.errorNum === 2291) {
             return res.status(400).json({ message: 'Invalid Campaign ID provided.' });
        }
        if (err.errorNum === 1) { 
             return res.status(409).json({ message: 'A project with this name may already exist.' });
        }
        res.status(500).json({ message: 'Internal server error while creating project.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * PATCH: Link an existing project to a specific campaign. Staff only.
 */
app.patch('/api/projects/:projId/link-campaign', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        const { projId } = req.params;
        const { campId } = req.body;

        if (!campId) {
            return res.status(400).json({ message: 'Campaign ID is required for linking.' });
        }

        connection = await oracledb.getConnection();
        
        const updateSql = `
            UPDATE PROJECT 
            SET CAMP_ID = :campId
            WHERE PROJ_ID = :projId`;
        
        const updateBinds = { campId, projId };

        const result = await connection.execute(updateSql, updateBinds, { autoCommit: true });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        res.status(200).json({ 
            message: `Project ${projId} successfully linked to Campaign ${campId}.`
        });

    } catch (err) {
        console.error('Error linking project to campaign:', err);
        // ORA-02291 is foreign key constraint violation (invalid CAMP_ID)
        if (err.errorNum === 2291) {
             return res.status(400).json({ message: 'Invalid Campaign ID provided.' });
        }
        res.status(500).json({ message: 'Internal server error while linking project.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

/**
 * PATCH: Update the SPENT amount for a specific project. (Staff only)
 * --- BUDGET ENFORCEMENT FIX INCLUDED ---
 * Blocks expenses that exceed the project's total budget.
 */
app.patch('/api/projects/:projId/expense', authenticateToken, authorizeStaff, async (req, res) => {
    let connection;
    try {
        const { projId } = req.params;
        const { expenseAmount } = req.body;

        if (expenseAmount == null || isNaN(Number(expenseAmount)) || Number(expenseAmount) <= 0) {
            return res.status(400).json({ message: 'Invalid expense amount provided.' });
        }

        const amountToAdd = Number(expenseAmount);

        connection = await oracledb.getConnection();

        // 1. Retrieve current project details (BUDGET and SPENT)
        const checkSql = `
            SELECT BUDGET, SPENT, PNAME
            FROM PROJECT
            WHERE PROJ_ID = :projId`;

        const checkResult = await connection.execute(checkSql, { projId });

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const project = checkResult.rows[0];
        const newSpent = project.SPENT + amountToAdd;

        // 2. Budget Check (ENFORCED)
        if (newSpent > project.BUDGET) {
            const remainingBudget = project.BUDGET - project.SPENT;

            // Return an error and STOP execution
            return res.status(400).json({
                message: `Expense blocked. This project's total budget is ₹${project.BUDGET.toLocaleString()}.
                          It has ₹${Math.max(0, remainingBudget).toLocaleString()} remaining.
                          Your expense of ₹${amountToAdd.toLocaleString()} would exceed the limit.`
            });
        }

        // 3. Update the SPENT amount
        const updateSql = `
            UPDATE PROJECT
            SET SPENT = :newSpent,
                STATUS = CASE WHEN :newSpent >= BUDGET THEN 'Completed' ELSE STATUS END
            WHERE PROJ_ID = :projId`;

        const updateBinds = { newSpent, projId };

        await connection.execute(updateSql, updateBinds, { autoCommit: true });

        res.status(200).json({
            message: `Expense of ₹${amountToAdd.toLocaleString()} successfully added to project '${project.PNAME}'.`,
            newSpentTotal: newSpent
        });

    } catch (err) {
        console.error('Error recording project expense:', err);
        res.status(500).json({ message: 'Internal server error while recording expense.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
});

/**
 * GET: Retrieve a list of all projects and their progress.
 * Accessible by any logged-in user (Staff or Donor).
 */
app.get('/api/projects/progress', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        
        // Select key project fields and calculate the spending percentage
        const sql = `
            SELECT 
                PROJ_ID, 
                PNAME, 
                BUDGET, 
                SPENT, 
                STATUS, 
                SDATE, 
                CAMP_ID,
                ROUND((SPENT / BUDGET) * 100, 2) AS SPENDING_PERCENT
            FROM PROJECT
            ORDER BY SPENT DESC`;
        
        const result = await connection.execute(sql);

        // Map the results to ensure 0/null values don't break the percentage calculation
        const projectsWithProgress = result.rows.map(project => ({
            ...project,
            // Handle division by zero/null explicitly on the server just in case
            SPENDING_PERCENT: project.BUDGET > 0 ? 
                                parseFloat(((project.SPENT / project.BUDGET) * 100).toFixed(2)) : 
                                0
        }));

        res.status(200).json({
            projects: projectsWithProgress
        });
    } catch (err) {
        console.error('Error fetching project progress:', err);
        res.status(500).json({ message: 'Failed to retrieve project progress data.' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// --- DONATION ROUTES (Donor-specific) ---

// GET: Fetch donation history for the authenticated DONOR
app.get('/api/donations', authenticateToken, authorizeDonor, async (req, res) => {
    let connection;
    try {
        const donId = req.user.primaryId; // This is the DONOR_ID
        connection = await oracledb.getConnection();

        // Fetch donations and the associated campaign name
        const sql = `
            SELECT d.DONOR_ID, d.DONATION_DATE, d.AMOUNT, c.C_NAME, d.CAMP_ID
            FROM DONATION d
            JOIN CAMPAIGN c ON d.CAMP_ID = c.CAMP_ID
            WHERE d.DONOR_ID = :donId
            ORDER BY d.DONATION_DATE DESC`;

        const result = await connection.execute(sql, { donId });
        res.status(200).json({ donations: result.rows });
    } catch (err) {
        console.error('Error fetching donor history:', err);
        res.status(500).json({ message: 'Failed to retrieve donation history.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
});

// POST: Record a new donation (used by Donor Dashboard)
app.post('/api/donations', authenticateToken, authorizeDonor, async (req, res) => {
    let connection;
    try {
        const { campId, amount } = req.body;
        const donorId = req.user.primaryId; // Get the authenticated Donor ID from JWT

        if (!campId || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid campaign or donation amount.' });
        }

        const donationAmount = Number(amount);
        // Get today's date in YYYY-MM-DD format for Oracle
        const donationDate = new Date().toISOString().slice(0, 10);

        connection = await oracledb.getConnection();

        // 1. Get next sequence value for unique DON_ID (assuming DONATION_SEQ exists)
        const seqResult = await connection.execute(`SELECT DONATION_SEQ.NEXTVAL AS NEW_ID FROM DUAL`);
        const newDonId = seqResult.rows[0].NEW_ID;

        // 2. Insert the new donation
        const insertSql = `
            INSERT INTO DONATION (DON_ID, DONOR_ID, CAMP_ID, AMOUNT, DON_DATE)
            VALUES (:newDonId, :donorId, :campId, :donationAmount, TO_DATE(:donationDate, 'YYYY-MM-DD'))`;

        const insertBinds = { newDonId, donorId, campId, donationAmount, donationDate };

        await connection.execute(insertSql, insertBinds, { autoCommit: true });

        // 3. Update the Campaign's total raised amount (You may need to add an AMOUNT_COLLECTED column to CAMPAIGN)
        const updateCampSql = `
            UPDATE CAMPAIGN
            SET AMOUNT_COLLECTED = AMOUNT_COLLECTED + :donationAmount
            WHERE CAMP_ID = :campId`;

        await connection.execute(updateCampSql, { donationAmount, campId }, { autoCommit: true });

        res.status(201).json({
            message: 'Donation successfully recorded.',
            donId: newDonId
        });

    } catch (err) {
        console.error('Error recording donation:', err);
        res.status(500).json({ message: 'Internal server error while recording donation.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
});

// GET: Donation Receipt Data (Used by DonorReceipt.jsx)
app.get('/api/donations/:donId', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { donId } = req.params;
        const authDonorId = req.user.primaryId;
        const authUserType = req.user.userType;

        connection = await oracledb.getConnection();

        const sql = `
            SELECT
                d.D_ID,
                d.DONOR_ID,
                d.AMOUNT,
                d.DONATION_DATE,
                c.C_NAME,
                c.CAMP_ID,
                // Fetch Donor details from the DONOR table for the receipt
                u.FNAME AS DONOR_FNAME,
                u.LNAME AS DONOR_LNAME
            FROM DONATION d
            JOIN CAMPAIGN c ON d.CAMP_ID = c.CAMP_ID
            JOIN DONOR u ON d.DONOR_ID = u.DONOR_ID
            WHERE d.DONOR_ID = :donId`;

        const result = await connection.execute(sql, { donId });

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Donation not found.' });
        }

        const donation = result.rows[0];

        // Authorization Check: Only the specific donor or a staff member can view the receipt
        if (authUserType === 'DONOR' && donation.DONOR_ID !== authDonorId) {
            return res.status(403).json({ message: 'Access denied: You can only view your own receipts.' });
        }

        res.status(200).json({ donation });

    } catch (err) {
        console.error('Error fetching donation receipt:', err);
        res.status(500).json({ message: 'Internal server error while retrieving receipt data.' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (err) { console.error(err); }
        }
    }
});


// --- START SERVER ---
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
});