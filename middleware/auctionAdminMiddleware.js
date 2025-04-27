/**
 * Auction Admin Middleware
 * Middleware for admin-specific auction operations
 */

const auctionState = require('../auction');
const { getIO } = require('../socket/auctionSocket');
const adminLogger = require('../utils/adminLogger');

// Admin action log
const adminActionLog = [];

/**
 * Log an admin action with details
 * @param {Object} action - Action details
 */
function logAdminAction(action) {
  // Use the admin logger
  return adminLogger.logAdminAction(action);
}

/**
 * Check if user is an auction admin
 */
exports.isAuctionAdmin = (req, res, next) => {
  // Check if user is logged in as admin
  if (!req.session || !req.session.admin || !req.session.admin.id) {
    return res.status(403).json({ 
      error: 'Unauthorized: Admin privileges required',
      status: 'error'
    });
  }
  
  // Add admin user info to request for logging
  req.adminUser = {
    id: req.session.admin.id,
    username: req.session.admin.username || 'admin'
  };
  
  next();
};

/**
 * Validate pause auction request
 */
exports.validatePauseAuction = (req, res, next) => {
  // Check if auction is running
  if (!auctionState.isRunning || auctionState.isPaused) {
    return res.status(400).json({
      error: auctionState.isPaused 
        ? 'Auction is already paused'
        : 'No auction is currently running',
      status: auctionState.isPaused ? 'paused' : 'not_running'
    });
  }
  
  // Log action
  logAdminAction({
    type: 'pause_auction',
    message: `Auction paused${req.body.reason ? ': ' + req.body.reason : ''}`,
    user: req.adminUser,
    details: {
      reason: req.body.reason || '',
      currentPlayer: auctionState.currentPlayer ? auctionState.currentPlayer.name : null,
      auctionStatus: {
        isRunning: auctionState.isRunning,
        isPaused: auctionState.isPaused,
        currentRound: auctionState.currentRound
      }
    }
  });
  
  next();
};

/**
 * Validate end auction request
 */
exports.validateEndAuction = (req, res, next) => {
  // Check if auction exists to end
  if (!auctionState.isRunning && !auctionState.isPaused) {
    return res.status(400).json({
      error: 'No auction is currently running or paused',
      status: 'not_running'
    });
  }
  
  // Log action
  logAdminAction({
    type: 'end_auction',
    message: `Auction ended${req.body.reason ? ': ' + req.body.reason : ''}`,
    user: req.adminUser,
    details: {
      reason: req.body.reason || '',
      soldPlayers: auctionState.soldPlayers.length,
      unsoldPlayers: auctionState.unsoldPlayers.length,
      currentRound: auctionState.currentRound,
      auctionStatus: {
        isRunning: auctionState.isRunning,
        isPaused: auctionState.isPaused
      }
    }
  });
  
  next();
};

/**
 * Middleware to notify all clients about admin actions via socket
 */
exports.notifyAdminAction = (actionType, message) => {
  return (req, res, next) => {
    // Get IO instance
    const io = getIO();
    
    if (io) {
      // Emit to all clients
      io.emit('admin-action', {
        action: actionType,
        message: message || `Admin action: ${actionType}`,
        timestamp: new Date().toISOString(),
        admin: req.adminUser ? req.adminUser.username : 'admin'
      });
    }
    
    next();
  };
};

// Export the admin action log functions
exports.logAdminAction = logAdminAction;
exports.getAdminActionLog = () => adminLogger.getRecentActions(); 