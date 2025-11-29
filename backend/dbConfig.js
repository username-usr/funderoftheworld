// dbConfig.js

const dbConfig = {
  // Use your THECHARITY schema user/password
  user: "THECHARITY", 
  password: "thecharity123", // ⚠️ MUST be replaced with your actual password
  
  // Connection String: Replace with your actual database host, port, and service name (or SID)
  // Common format for local DBs (like XE):
  connectString: "localhost:1521/XE", 
  
  // Alternative format if using a TNS alias:
  // connectString: "YOUR_TNS_ALIAS", 
};

module.exports = dbConfig;