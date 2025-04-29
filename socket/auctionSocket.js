/**
 * Socket.IO configuration for real-time auction updates
 */

let io = null;

// Authentication middleware for socket connections
const socketAuthMiddleware = require('../middleware/socketAuthMiddleware');
const { timerManager } = require('../auction');

// Initialize Socket.IO
const init = (ioInstance) => {
  // Use the provided io instance instead of creating a new one
  io = ioInstance;
  
  // Apply authentication middleware
  io.use(socketAuthMiddleware);
  
  // Handle connections
  io.on('connection', (socket) => {
    console.log('New client connected', socket.id);
    
    // If user has a team_id, join that team's room
    if (socket.user && socket.user.team_id) {
      socket.join(`team:${socket.user.team_id}`);
      console.log(`User joined team room: team:${socket.user.team_id}`);
    }
    
    // Always join the 'auction' room for auction updates
    socket.join('auction');
    console.log(`User joined auction room`);
    
    // Handle client disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });
    
    // Handle bid submission from clients
    socket.on('place-bid', (data) => {
      console.log('Bid received:', data);
      // Forward to controller via HTTP route (handled by frontend)
    });
  });
  
  return io;
};

// Get the Socket.IO instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Export function to emit auction status to all clients in the auction room
const emitAuctionStatus = (statusObj) => {
  try {
    // Convert any status object to have both old and new field names for compatibility
    const status = statusObj.status || (statusObj.isPaused ? 'paused' : (statusObj.isWaiting ? 'waiting' : 'running'));
    
    // Create a normalized status object with standardized fields
    const normalizedStatus = {
      // New field names
      isRunning: statusObj.isRunning !== undefined ? statusObj.isRunning : true,
      isPaused: statusObj.isPaused !== undefined ? statusObj.isPaused : false,
      isWaiting: statusObj.isWaiting !== undefined ? statusObj.isWaiting : false,
      timeRemaining: statusObj.timeRemaining || 0,
      
      // Legacy field for backward compatibility
      status: status,
      
      // Include message if provided
      message: statusObj.message || `Auction is ${status}`
    };
    
    // Include current player info if it exists
    if (statusObj.currentPlayer) {
      normalizedStatus.currentPlayer = {
        id: statusObj.currentPlayer.id || statusObj.currentPlayer._id,
        name: statusObj.currentPlayer.name,
        role: statusObj.currentPlayer.role,
        basePrice: statusObj.currentPlayer.basePrice || statusObj.currentPlayer.base_price,
        image: statusObj.currentPlayer.image_url || statusObj.currentPlayer.image
      };
    }
    
    // Add timestamp to help clients calculate elapsed time
    normalizedStatus.timestamp = Date.now();
    
    // Make sure we include correct timer information
    if (normalizedStatus.isWaiting) {
      normalizedStatus.timerType = 'waiting';
      normalizedStatus.timeRemaining = timerManager.getRemainingWaitingTime();
    } else if (normalizedStatus.isRunning && !normalizedStatus.isPaused) {
      normalizedStatus.timerType = 'bidding';
      normalizedStatus.timeRemaining = timerManager.getRemainingBidTime();
    }
    
    if (io) {
      // Emit with both event names for backward compatibility
      io.to('auction').emit('auction-status', normalizedStatus);
      
      // Also emit with the event name used in projector.ejs
      if (normalizedStatus.currentPlayer) {
        io.to('auction').emit('playerUpdate', {
          player: normalizedStatus.currentPlayer,
          highestBid: statusObj.highestBid || normalizedStatus.currentPlayer.basePrice,
          highestBidder: statusObj.highestBidder || null,
          timestamp: normalizedStatus.timestamp
        });
      }
      
      console.log('Emitted auction status:', {
        status: normalizedStatus.status,
        isRunning: normalizedStatus.isRunning,
        isPaused: normalizedStatus.isPaused,
        isWaiting: normalizedStatus.isWaiting,
        currentPlayer: normalizedStatus.currentPlayer?.name,
        timeRemaining: normalizedStatus.timeRemaining
      });
    } else {
      console.warn('IO not initialized when attempting to emit auction status');
    }
  } catch (error) {
    console.error('Error emitting auction status:', error);
  }
};

// Function to emit timer status updates
const emitTimerStatus = (timerType, status, timeRemaining) => {
  try {
    if (!io) {
      console.warn('IO not initialized when attempting to emit timer status');
      return;
    }
    
    const timerStatus = {
      type: timerType, // 'bid' or 'waiting'
      status: status,  // 'running', 'paused', 'stopped'
      timeRemaining: timeRemaining || 0
    };
    
    io.to('auction').emit('timer-update', timerStatus);
  } catch (error) {
    console.error('Error emitting timer status:', error);
  }
};

// Emit player updates to all connected clients
const emitPlayerUpdate = (data) => {
  try {
    const { player, highestBid, highestBidder } = data;
    
    if (!player) {
      console.error('No player data provided to emitPlayerUpdate');
      return;
    }
    
    // Format player data consistently
    const formattedPlayer = {
      id: player.id || player._id,
      name: player.name,
      role: player.role,
      basePrice: player.base_price || player.basePrice,
      image: player.image_url || player.image,
      team: player.team,
      status: player.status
    };

    // Create update object with all necessary information
    const updateData = {
      player: formattedPlayer,
      highestBid: highestBid || formattedPlayer.basePrice || 0,
      highestBidder: highestBidder || null,
      timestamp: new Date().toISOString()
    };

    // Emit to all connected clients in the auction room
    if (io) {
      // Emit player update event
      io.to('auction').emit('playerUpdate', updateData);
      
      // Also emit auction status update with current player info
      emitAuctionStatus({
        isRunning: true,
        isPaused: false,
        isWaiting: false,
        status: 'running',
        currentPlayer: formattedPlayer,
        timeRemaining: timerManager.getRemainingBidTime(),
        message: `Current player: ${formattedPlayer.name}`
      });

      console.log('Emitted player update:', {
        playerId: formattedPlayer.id,
        playerName: formattedPlayer.name,
        highestBid: updateData.highestBid,
        highestBidder: updateData.highestBidder?.name || 'None'
      });
    } else {
      console.warn('IO not initialized when attempting to emit player update');
    }
  } catch (error) {
    console.error('Error in emitPlayerUpdate:', error);
  }
};

// Emit auction result (sold or unsold) to all connected clients
const emitAuctionResult = (result) => {
  if (!io) return;
  io.to('auction').emit('auction-result', result);
};

// Emit timer updates to all connected clients
const emitTimerUpdate = (timeRemaining, isPaused = false) => {
  if (!io) return;
  
  // Create a timer update object
  const timerData = {
    timeRemaining: timeRemaining,
    isPaused: isPaused,
    timestamp: Date.now() // Add timestamp for calculating elapsed time on client
  };
  
  // Emit to all clients in the auction room
  io.to('auction').emit('timer-update', timerData);
  
  // Log timer update (uncomment for debugging)
  // console.log('Timer update emitted:', timerData);
};

// Emit waiting countdown updates to all connected clients
const emitWaitingCountdown = (seconds, isPaused = false) => {
  if (!io) return;
  
  // Create a countdown update object
  const countdownData = {
    seconds: seconds,
    isPaused: isPaused,
    timestamp: Date.now() // Add timestamp for calculating elapsed time on client
  };
  
  // Emit to all clients in the auction room
  io.to('auction').emit('waiting-countdown', countdownData);
};

// Send specific message to a team
const sendTeamMessage = (teamId, event, data) => {
  if (!io) return;
  io.to(`team-${teamId}`).emit(event, data);
};

// Emit admin action notification to all connected clients
const emitAdminAction = (action, message, data = {}) => {
  if (!io) return;
  
  io.to('auction').emit('admin-action', {
    action,
    message,
    timestamp: new Date(),
    ...data
  });
};

// Emit auction state change notification
const emitStateChange = (prevState, newState, reason, adminUser = null) => {
  if (!io) return;
  
  const stateChangeData = {
    prevState,
    newState,
    reason,
    adminUser,
    timestamp: new Date()
  };
  
  io.to('auction').emit('auction-state-change', stateChangeData);
};

// Export functions
module.exports = {
  init,
  getIO,
  emitAuctionStatus,
  emitTimerStatus,
  emitPlayerUpdate,
  emitAuctionResult,
  emitTimerUpdate,
  emitWaitingCountdown,
  sendTeamMessage,
  emitAdminAction,
  emitStateChange
};

// Add backward compatibility exports
exports.init = init;
exports.getIO = getIO;
exports.emitAuctionStatus = emitAuctionStatus;
exports.emitTimerStatus = emitTimerStatus;
exports.emitPlayerUpdate = emitPlayerUpdate;
exports.emitAuctionResult = emitAuctionResult;
exports.emitTimerUpdate = emitTimerUpdate;
exports.emitWaitingCountdown = emitWaitingCountdown;
exports.emitToTeam = sendTeamMessage;
exports.emitAdminAction = emitAdminAction;
exports.emitStateChange = emitStateChange; 