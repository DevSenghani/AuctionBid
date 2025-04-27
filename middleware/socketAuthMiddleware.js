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
    
    // Initialize with authentication status false
    let authenticated = false;
    
    // Store team info on the socket object
    socket.user = {
      team_id: teamId,
      team_name: teamName,
      authenticated: false // Default to false
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
        authenticated = true;
      } catch (err) {
        console.warn('Invalid token in socket connection:', err.message);
        // Continue without authentication
      }
    }
    
    // Check if team info is complete from handshake auth - if so, consider authenticated
    if (!authenticated && teamId && teamName) {
      socket.user.authenticated = true;
      authenticated = true;
    }
    
    console.log(`Socket authenticated: ${socket.id}, Team: ${teamName || 'Unknown'}, Auth Status: ${authenticated}`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    // Allow connection even if authentication fails
    // Just mark as unauthenticated
    socket.user = { authenticated: false };
    next();
  }
}; 