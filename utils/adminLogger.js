/**
 * Admin Logger Utility
 * Provides logging functionality for admin actions
 */

const fs = require('fs');
const path = require('path');
const logDir = path.join(__dirname, '../logs');
const logFile = path.join(logDir, 'admin_actions.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// In-memory log storage (limited to 1000 entries)
const actionLog = [];
const MAX_LOG_ENTRIES = 1000;

/**
 * Log an admin action with details
 * @param {Object} action - Action details
 * @param {string} action.type - Type of action (e.g., 'pause_auction', 'end_auction')
 * @param {string} action.message - Description of the action
 * @param {Object} action.user - Admin user who performed the action
 * @param {string} action.userId - ID of the admin user
 * @param {string} action.username - Username of the admin user
 * @param {Object} [action.details] - Additional details about the action
 * @returns {Object} The logged action with timestamp
 */
function logAdminAction(action) {
  const timestamp = new Date();
  
  // Create the log entry
  const logEntry = {
    timestamp,
    timestampISO: timestamp.toISOString(),
    type: action.type,
    message: action.message,
    user: {
      id: action.userId || (action.user ? action.user.id : 'unknown'),
      username: action.username || (action.user ? action.user.username : 'unknown')
    },
    details: action.details || {}
  };
  
  // Add to in-memory log
  actionLog.unshift(logEntry);
  
  // Trim if needed
  if (actionLog.length > MAX_LOG_ENTRIES) {
    actionLog.length = MAX_LOG_ENTRIES;
  }
  
  // Format for file logging
  const logLine = JSON.stringify(logEntry);
  
  // Write to file
  fs.appendFile(logFile, logLine + '\n', (err) => {
    if (err) {
      console.error('Error writing to admin action log:', err);
    }
  });
  
  // Also output to console
  console.log(`[ADMIN ACTION] ${timestamp.toISOString()} - ${action.type}: ${action.message} by ${logEntry.user.username}`);
  
  return logEntry;
}

/**
 * Get recent admin actions
 * @param {number} limit - Maximum number of actions to retrieve
 * @returns {Array} Recent admin actions
 */
function getRecentActions(limit = 50) {
  return actionLog.slice(0, Math.min(limit, actionLog.length));
}

/**
 * Get admin actions by type
 * @param {string} type - Type of action to filter by
 * @param {number} limit - Maximum number of actions to retrieve
 * @returns {Array} Filtered admin actions
 */
function getActionsByType(type, limit = 50) {
  return actionLog
    .filter(action => action.type === type)
    .slice(0, limit);
}

/**
 * Get admin actions by user
 * @param {string} userId - User ID to filter by
 * @param {number} limit - Maximum number of actions to retrieve
 * @returns {Array} Filtered admin actions
 */
function getActionsByUser(userId, limit = 50) {
  return actionLog
    .filter(action => action.user.id === userId)
    .slice(0, limit);
}

/**
 * Clear all logged actions (mainly for testing)
 */
function clearActionLog() {
  actionLog.length = 0;
}

// Export the functions
module.exports = {
  logAdminAction,
  getRecentActions,
  getActionsByType,
  getActionsByUser,
  clearActionLog
}; 