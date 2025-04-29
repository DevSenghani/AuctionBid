// auction.js - Main auction state management

const TimerManager = require('./utils/timerManager');
const { EventEmitter } = require('events');

/**
 * Class to manage auction state with better encapsulation and validation
 */
class AuctionManager extends EventEmitter {
  constructor() {
    super();
    
    // Initialize auction state
    this.state = {
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
    
    // Initialize timer manager with reference to the state
    this.timerManager = new TimerManager(this.state);
  }
  
  /**
   * Reset auction state to initial values
   */
  resetState() {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.isWaiting = false;
    this.state.currentPlayerId = null;
    this.state.startTime = null;
    this.state.currentPlayer = null;
    this.state.currentRound = 1;
    this.state.soldPlayers = [];
    this.state.highestBid = 0;
    this.state.highestBidder = null;
    this.state.completedPlayers = [];
    this.state.unsoldPlayers = [];
    this.state.isAuctionEnded = false;
    
    // Emit state change event
    this.emit('stateChange', null, this.state, 'reset');
    return this.state;
  }
  
  /**
   * Start the auction
   */
  start() {
    const prevState = { ...this.state };
    
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.isWaiting = true;
    this.state.startTime = new Date();
    this.state.isAuctionEnded = false;
    
    // Emit state change event
    this.emit('stateChange', prevState, this.state, 'start');
    return this.state;
  }
  
  /**
   * Pause the auction
   */
  pause() {
    if (!this.state.isRunning) {
      return this.state;
    }
    
    const prevState = { ...this.state };
    this.state.isPaused = true;
    
    // Emit state change event
    this.emit('stateChange', prevState, this.state, 'pause');
    return this.state;
  }
  
  /**
   * Resume the auction
   */
  resume() {
    if (!this.state.isPaused) {
      return this.state;
    }
    
    const prevState = { ...this.state };
    this.state.isPaused = false;
    
    // Emit state change event
    this.emit('stateChange', prevState, this.state, 'resume');
    return this.state;
  }
  
  /**
   * End the auction
   */
  end() {
    const prevState = { ...this.state };
    
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.isWaiting = false;
    this.state.isAuctionEnded = true;
    
    // Emit state change event
    this.emit('stateChange', prevState, this.state, 'end');
    return this.state;
  }
  
  /**
   * Get a read-only copy of the current state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Set current player being auctioned
   * @param {Object} player - Player object
   */
  setCurrentPlayer(player) {
    if (!player || !player.id) {
      throw new Error('Invalid player object');
    }
    
    const prevState = { ...this.state };
    this.state.currentPlayer = player;
    this.state.currentPlayerId = player.id;
    this.state.highestBid = player.base_price || 0;
    this.state.highestBidder = null;
    
    // Emit state change event
    this.emit('stateChange', prevState, this.state, 'playerChange');
    return this.state;
  }
}

// Create a singleton instance
const auctionManager = new AuctionManager();

// For backwards compatibility
const auctionState = auctionManager.state;
const timerManager = auctionManager.timerManager;

// Export the manager and compatibility objects
module.exports = {
  auctionManager,
  auctionState,
  timerManager,
  resetAuctionState: () => auctionManager.resetState(),
  startAuction: () => auctionManager.start(),
  pauseAuction: () => auctionManager.pause(),
  resumeAuction: () => auctionManager.resume(),
  endAuction: () => auctionManager.end()
}; 