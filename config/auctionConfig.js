/**
 * Auction-specific configuration settings
 */

module.exports = {
  // Bid timer durations
  bidTimerDuration: 30 * 1000, // 30 seconds for bidding
  waitingTimerDuration: 10 * 1000, // 10 seconds between players
  
  // Minimum time (in seconds) to keep the timer active after a new bid
  minTimerAfterBid: 15,
  
  // Bid increments
  minBidIncrement: 10000, // ₹10,000 minimum increment
  
  // Maximum number of unsold players to keep in the pool
  maxUnsoldPlayersPool: 50
}; 