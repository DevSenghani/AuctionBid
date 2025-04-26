/**
 * Socket.IO configuration for real-time auction updates
 */

const socketIO = require('socket.io');
let io = null;

// Authentication middleware for socket connections
const socketAuthMiddleware = require('../middleware/socketAuthMiddleware');

// Initialize Socket.IO
exports.init = (server) => {
  io = socketIO(server);
  
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
exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Emit auction status updates to all connected clients
exports.emitAuctionStatus = (status) => {
  if (!io) return;
  io.to('auction').emit('auction-status', status);
};

// Emit player updates to all connected clients
exports.emitPlayerUpdate = (data) => {
  if (!io) return;
  io.to('auction').emit('player-update', data);
};

// Emit auction result (sold or unsold) to all connected clients
exports.emitAuctionResult = (result) => {
  if (!io) return;
  io.to('auction').emit('auction-result', result);
};

// Emit timer updates to all connected clients
exports.emitTimerUpdate = (timeRemaining) => {
  if (!io) return;
  io.to('auction').emit('timer-update', { timeRemaining });
};

// Emit waiting countdown updates to all connected clients
exports.emitWaitingCountdown = (timeRemaining) => {
  if (!io) return;
  io.to('auction').emit('waiting-countdown', { timeRemaining });
};

// Send specific message to a team
exports.emitToTeam = (teamId, event, data) => {
  if (!io) return;
  io.to(`team-${teamId}`).emit(event, data);
}; 