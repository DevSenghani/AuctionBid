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
  if (!req.session || !req.session.isAdmin) {
    return res.status(403).json({ 
      error: 'Unauthorized: Admin privileges required',
      status: 'error'
    });
  }
  
  // Add admin user info to request for logging
  req.adminUser = {
    id: req.session.adminId || 'admin',
    username: req.session.adminUsername || 'admin'
  };
  
  next();
};

/**
 * Validate pause auction request
 */
exports.validatePauseAuction = (req, res, next) => {
  // Debug log to check auction state
  console.log('Validating pause request, current auction state:', {
    isRunning: auctionState.isRunning,
    isPaused: auctionState.isPaused
  });
  
  // Check if auction is running and not already paused
  if (auctionState.isPaused) {
    return res.status(400).json({
      error: 'Auction is already paused',
      status: 'paused'
    });
  }
  
  if (!auctionState.isRunning) {
    return res.status(400).json({
      error: 'No auction is currently running',
      status: 'not_running'
    });
  }
  
  // Ensure adminUser exists
  if (!req.adminUser) {
    req.adminUser = {
      id: 'unknown',
      username: req.session.adminUsername || 'admin'
    };
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
  // Debug log to check auction state
  console.log('Validating end auction request, current auction state:', {
    isRunning: auctionState.isRunning,
    isPaused: auctionState.isPaused
  });
  
  // Check if auction exists to end (either running or paused)
  if (!auctionState.isRunning && !auctionState.isPaused) {
    return res.status(400).json({
      error: 'No auction is currently running or paused',
      status: 'not_running'
    });
  }
  
  // Ensure adminUser exists
  if (!req.adminUser) {
    req.adminUser = {
      id: 'unknown',
      username: req.session.adminUsername || 'admin'
    };
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
    // Debug log to check auction state
    console.log(`Admin action: ${actionType}, current auction state:`, {
      isRunning: auctionState.isRunning,
      isPaused: auctionState.isPaused,
      isWaiting: auctionState.isWaiting
    });
    
    // Get IO instance
    const io = getIO();
    
    // Get admin username from session or request
    const adminUsername = req.adminUser?.username || req.session?.adminUsername || 'admin';
    
    if (io) {
      // Emit to all clients
      io.emit('admin-action', {
        action: actionType,
        message: message || `Admin action: ${actionType}`,
        timestamp: new Date().toISOString(),
        admin: adminUsername
      });
    }
    
    next();
  };
};

// Export the admin action log functions
exports.logAdminAction = logAdminAction;
exports.getAdminActionLog = () => adminLogger.getRecentActions(); 