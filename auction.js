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
  unsoldPlayers: [],
  isAuctionEnded: false
};

// Initialize the timer manager with auction state
const timerManager = new TimerManager(auctionState);

// Function to reset auction state
function resetAuctionState() {
  auctionState.isRunning = false;
  auctionState.isPaused = false;
  auctionState.isWaiting = false;
  auctionState.currentPlayerId = null;
  auctionState.startTime = null;
  auctionState.currentPlayer = null;
  auctionState.currentRound = 1;
  auctionState.soldPlayers = [];
  auctionState.highestBid = 0;
  auctionState.highestBidder = null;
  auctionState.completedPlayers = [];
  auctionState.unsoldPlayers = [];
  auctionState.isAuctionEnded = false;
}

// Function to start auction
function startAuction() {
  auctionState.isRunning = true;
  auctionState.isPaused = false;
  auctionState.isWaiting = true;
  auctionState.startTime = new Date();
  auctionState.isAuctionEnded = false;
}

// Function to pause auction
function pauseAuction() {
  if (auctionState.isRunning) {
    auctionState.isPaused = true;
  }
}

// Function to resume auction
function resumeAuction() {
  if (auctionState.isPaused) {
    auctionState.isPaused = false;
  }
}

// Function to end auction
function endAuction() {
  auctionState.isRunning = false;
  auctionState.isPaused = false;
  auctionState.isWaiting = false;
  auctionState.isAuctionEnded = true;
}

module.exports = {
  auctionState,
  timerManager,
  resetAuctionState,
  startAuction,
  pauseAuction,
  resumeAuction,
  endAuction
}; 