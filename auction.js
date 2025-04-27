// auction.js - Main auction state management

const TimerManager = require('./utils/timerManager');

// Global auction state
const auctionState = {
  isRunning: false,
  isPaused: false,
  isWaiting: false, // State for waiting period between players
  currentPlayerId: null,
  startTime: null,
  availablePlayers: [],
  currentPlayer: null,
  currentRound: 1,
  soldPlayers: [],
  highestBid: 0,
  highestBidder: null,
  completedPlayers: [],
  unsoldPlayers: []
};

// Initialize the timer manager with auction state
const timerManager = new TimerManager(auctionState);

module.exports = {
  auctionState,
  timerManager
}; 