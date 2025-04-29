/**
 * Configuration settings for the application
 */

module.exports = {
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'cricket-auction-secret-key',
  jwtExpiry: '1d',
  
  // Server configuration
  port: process.env.PORT || 3001,
  
  // Auction configuration
  auction: {
    bidTimerDuration: 30, // seconds
    waitingTimerDuration: 10, // seconds
    minBidIncrement: 10000 // minimum bid increment amount
  }
}; 