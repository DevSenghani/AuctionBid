/**
 * Socket.IO authentication middleware
 * Authenticates socket connections and attaches team information to the socket
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');

module.exports = async (socket, next) => {
  try {
    // Get auth data from handshake
    const { teamId, teamName } = socket.handshake.auth;
    
    // Store team info on the socket object
    socket.user = {
      team_id: teamId,
      team_name: teamName
    };
    
    // Check if there's a token in the cookie or handshake auth
    const token = 
      socket.handshake.headers.cookie?.split(';')
        .find(c => c.trim().startsWith('token='))
        ?.split('=')[1] || 
      socket.handshake.auth.token;
    
    // If token exists, verify it
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.user = {
          ...socket.user,
          ...decoded,
          authenticated: true
        };
      } catch (err) {
        console.warn('Invalid token in socket connection:', err.message);
        // Continue without authentication
      }
    }
    
    console.log(`Socket authenticated: ${socket.id}, Team: ${teamName || 'Unknown'}`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    // Allow connection even if authentication fails
    // Just mark as unauthenticated
    socket.user = { authenticated: false };
    next();
  }
}; 