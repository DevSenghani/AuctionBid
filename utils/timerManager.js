// utils/timerManager.js

// Instead of importing at the top where it can cause circular dependencies,
// we'll get these functions when needed
// const { emitTimerUpdate, emitWaitingCountdown } = require('../socket/auctionSocket');
const config = require('../config/auctionConfig');

/**
 * Manages timers for the auction system with improved error handling and performance
 */
class TimerManager {
  constructor(auctionState) {
    this.auctionState = auctionState;
    this.bidTimer = null;
    this.waitingTimer = null;
    this.bidTimerDuration = config.auction.defaultPlayerAuctionTime;
    this.waitingTimerDuration = config.auction.defaultWaitingTime;
    this.timeRemaining = 0;
    this.waitingTimeRemaining = 0;
    this.bidStartTime = null;
    this.waitingStartTime = null;
    this.pausedBidTimeRemaining = null;
    this.pausedWaitingTimeRemaining = null;
    this.updateInterval = null;
    
    // Track callbacks to ensure they're only called once
    this.bidTimerCallback = null;
    this.waitingTimerCallback = null;
    
    // Set up interval for emitting regular updates
    this.setupUpdateInterval();
  }
  
  /**
   * Set up an interval to send regular timer updates to clients
   */
  setupUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Emit timer updates every second
    this.updateInterval = setInterval(() => {
      this.emitTimerUpdates();
    }, 1000);
  }
  
  /**
   * Function to emit real-time timer updates to all clients
   */
  emitTimerUpdates() {
    try {
      // Get socket functions dynamically to prevent circular dependencies
      const socketModule = require('../socket/auctionSocket');
      
      if (this.bidTimer) {
        socketModule.emitTimerUpdate(this.timeRemaining, false);
      } else if (this.waitingTimer) {
        socketModule.emitWaitingCountdown(this.waitingTimeRemaining, false);
      } else if (this.pausedBidTimeRemaining !== null) {
        socketModule.emitTimerUpdate(this.pausedBidTimeRemaining, true);
      } else if (this.pausedWaitingTimeRemaining !== null) {
        socketModule.emitWaitingCountdown(this.pausedWaitingTimeRemaining, true);
      }
    } catch (error) {
      console.error('Error emitting timer updates:', error);
    }
  }

  /**
   * Start the bidding timer
   * @param {Function} callback - Function to call when timer expires
   */
  startBidTimer(callback) {
    try {
      console.log('Starting bid timer...');
      
      // Clear any existing timers
      this.stopAllTimers();
      
      // Store the callback
      this.bidTimerCallback = callback;
      
      // Set initial bid time
      this.timeRemaining = this.bidTimerDuration;
      this.bidStartTime = Date.now();
      
      // Get the socket module
      const socketModule = require('../socket/auctionSocket');
      
      // Start the timer
      this.bidTimer = setInterval(() => {
        this.timeRemaining--;
        
        // Emit timer update to clients
        socketModule.emitTimerUpdate(this.timeRemaining, false);
        
        // When timer reaches 0
        if (this.timeRemaining <= 0) {
          // Save the callback before stopping the timer
          const savedCallback = this.bidTimerCallback;
          this.stopBidTimer();
          
          // Execute the callback if it exists
          if (savedCallback) {
            try {
              savedCallback();
            } catch (callbackError) {
              console.error('Error in bid timer callback:', callbackError);
            }
          }
        }
      }, 1000);
      
      console.log(`Bid timer started successfully for ${this.bidTimerDuration} seconds`);
    } catch (error) {
      console.error('Error starting bid timer:', error);
      this.stopAllTimers();
      throw new Error('Failed to start bid timer: ' + error.message);
    }
  }

  /**
   * Pause the bidding timer
   * @returns {number} Time remaining when paused
   */
  pauseBidTimer() {
    try {
      if (this.bidTimer) {
        clearInterval(this.bidTimer);
        this.bidTimer = null;
        
        // Calculate exact time remaining
        const elapsed = Math.floor((Date.now() - this.bidStartTime) / 1000);
        this.pausedBidTimeRemaining = Math.max(0, this.bidTimerDuration - elapsed);
        
        // Emit pause status to clients
        const socketModule = require('../socket/auctionSocket');
        socketModule.emitTimerUpdate(this.pausedBidTimeRemaining, true);
        
        this.bidStartTime = null;
        console.log(`Bid timer paused with ${this.pausedBidTimeRemaining} seconds remaining`);
        return this.pausedBidTimeRemaining;
      }
      return 0;
    } catch (error) {
      console.error('Error pausing bid timer:', error);
      return 0;
    }
  }

  /**
   * Stop the bidding timer completely
   */
  stopBidTimer() {
    if (this.bidTimer) {
      clearInterval(this.bidTimer);
      this.bidTimer = null;
      this.bidStartTime = null;
      this.pausedBidTimeRemaining = null;
      this.bidTimerCallback = null;
      console.log('Bid timer stopped');
    }
  }

  /**
   * Start the waiting timer between players
   * @param {Function} callback - Function to call when timer expires
   */
  startWaitingTimer(callback) {
    try {
      console.log('Starting waiting timer...');
      
      // Clear any existing timers
      this.stopAllTimers();
      
      // Store the callback
      this.waitingTimerCallback = callback;
      
      // Set initial waiting time
      this.waitingTimeRemaining = this.waitingTimerDuration;
      this.waitingStartTime = Date.now();
      
      // Get the socket module
      const socketModule = require('../socket/auctionSocket');
      
      // Start the timer
      this.waitingTimer = setInterval(() => {
        this.waitingTimeRemaining--;
        
        // Emit timer update to clients
        socketModule.emitWaitingCountdown(this.waitingTimeRemaining, false);
        
        // When timer reaches 0
        if (this.waitingTimeRemaining <= 0) {
          // Save the callback before stopping the timer
          const savedCallback = this.waitingTimerCallback;
          this.stopWaitingTimer();
          
          // Execute the callback if it exists
          if (savedCallback) {
            try {
              savedCallback();
            } catch (callbackError) {
              console.error('Error in waiting timer callback:', callbackError);
            }
          }
        }
      }, 1000);
      
      console.log(`Waiting timer started successfully for ${this.waitingTimerDuration} seconds`);
    } catch (error) {
      console.error('Error starting waiting timer:', error);
      this.stopAllTimers();
      throw new Error('Failed to start waiting timer: ' + error.message);
    }
  }

  pauseWaitingTimer() {
    try {
      if (this.waitingTimer) {
        clearInterval(this.waitingTimer);
        this.waitingTimer = null;
        
        // Calculate exact time remaining
        const elapsed = Math.floor((Date.now() - this.waitingStartTime) / 1000);
        this.pausedWaitingTimeRemaining = Math.max(0, this.waitingTimerDuration - elapsed);
        
        // Emit pause status to clients with timestamp
        const socketModule = require('../socket/auctionSocket');
        socketModule.emitWaitingCountdown(this.pausedWaitingTimeRemaining, true);
        
        this.waitingStartTime = null;
        return this.pausedWaitingTimeRemaining;
      }
      return 0;
    } catch (error) {
      console.error('Error pausing waiting timer:', error);
      return 0;
    }
  }

  stopWaitingTimer() {
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
      this.waitingTimer = null;
      this.waitingStartTime = null;
      this.pausedWaitingTimeRemaining = null;
      console.log('Waiting timer stopped');
    }
  }

  stopAllTimers() {
    this.stopBidTimer();
    this.stopWaitingTimer();
    console.log('All timers stopped');
  }

  pauseAllTimers() {
    const timers = {
      waitingTimeRemaining: this.waitingTimeRemaining,
      bidTimeRemaining: this.timeRemaining,
      timestamp: Date.now()
    };
    
    this.stopAllTimers();
    console.log('All timers paused with remaining times:', timers);
    
    return timers;
  }

  resetTimers() {
    this.waitingTimeRemaining = 0;
    this.timeRemaining = 0;
    this.bidStartTime = null;
    this.waitingStartTime = null;
    this.pausedBidTimeRemaining = null;
    this.pausedWaitingTimeRemaining = null;
    this.stopAllTimers();
    console.log('All timers reset');
  }

  getRemainingBidTime() {
    // If timer is paused, return the stored value
    if (this.pausedBidTimeRemaining !== null) {
      return this.pausedBidTimeRemaining;
    }
    
    // If timer is running, calculate the current time based on start time
    if (this.bidStartTime) {
      const elapsed = Math.floor((Date.now() - this.bidStartTime) / 1000);
      return Math.max(0, this.bidTimerDuration - elapsed);
    }
    
    // Default return the current timeRemaining
    return this.timeRemaining;
  }

  getRemainingWaitingTime() {
    // If timer is paused, return the stored value
    if (this.pausedWaitingTimeRemaining !== null) {
      return this.pausedWaitingTimeRemaining;
    }
    
    // If timer is running, calculate the current time based on start time
    if (this.waitingStartTime) {
      const elapsed = Math.floor((Date.now() - this.waitingStartTime) / 1000);
      return Math.max(0, this.waitingTimerDuration - elapsed);
    }
    
    // Default return the current waitingTimeRemaining
    return this.waitingTimeRemaining;
  }

  // Get the current pause state
  getPauseState() {
    return {
      waitingTimeRemaining: this.pausedWaitingTimeRemaining || 0,
      bidTimeRemaining: this.pausedBidTimeRemaining || 0,
      timestamp: Date.now()
    };
  }
  
  // Resume bid timer with previously stored time
  resumeBidTimer(callback) {
    try {
      console.log('Resuming bid timer...');
      
      // Check if there's a paused time
      if (this.pausedBidTimeRemaining === null) {
        console.warn('No paused bid time found, using default value');
        this.pausedBidTimeRemaining = 30; // Default to 30 seconds if no stored value
      }
      
      // Set initial time from paused value
      this.timeRemaining = this.pausedBidTimeRemaining;
      this.bidStartTime = Date.now();
      
      // Clear the paused value
      this.pausedBidTimeRemaining = null;
      
      // Get the socket module
      const socketModule = require('../socket/auctionSocket');
      
      // Start the timer
      this.bidTimer = setInterval(() => {
        this.timeRemaining--;
        
        // Emit remaining time to all clients
        socketModule.emitTimerUpdate(this.timeRemaining, false);
        
        // When timer reaches 0
        if (this.timeRemaining <= 0) {
          // Save the callback before stopping the timer
          const savedCallback = callback;
          this.stopBidTimer();
          
          // Execute the callback if it exists
          if (savedCallback) {
            try {
              savedCallback();
            } catch (callbackError) {
              console.error('Error in bid timer callback:', callbackError);
            }
          }
        }
      }, 1000);
      
      console.log('Bid timer resumed successfully with', this.timeRemaining, 'seconds remaining');
    } catch (error) {
      console.error('Error resuming bid timer:', error);
      this.stopAllTimers();
      throw new Error('Failed to resume bid timer: ' + error.message);
    }
  }
  
  // Resume waiting timer with previously stored time
  resumeWaitingTimer(callback) {
    try {
      console.log('Resuming waiting timer...');
      
      // Check if there's a paused time
      if (this.pausedWaitingTimeRemaining === null) {
        console.warn('No paused waiting time found, using default value');
        this.pausedWaitingTimeRemaining = 10; // Default to 10 seconds if no stored value
      }
      
      // Set initial time from paused value
      this.waitingTimeRemaining = this.pausedWaitingTimeRemaining;
      this.waitingStartTime = Date.now();
      
      // Clear the paused value
      this.pausedWaitingTimeRemaining = null;
      
      // Get the socket module
      const socketModule = require('../socket/auctionSocket');
      
      // Start the timer
      this.waitingTimer = setInterval(() => {
        this.waitingTimeRemaining--;
        
        // Emit remaining time to all clients
        socketModule.emitWaitingCountdown(this.waitingTimeRemaining, false);
        
        // When timer reaches 0
        if (this.waitingTimeRemaining <= 0) {
          // Save the callback before stopping the timer
          const savedCallback = callback;
          this.stopWaitingTimer();
          
          // Execute the callback if it exists
          if (savedCallback) {
            try {
              savedCallback();
            } catch (callbackError) {
              console.error('Error in waiting timer callback:', callbackError);
            }
          }
        }
      }, 1000);
      
      console.log('Waiting timer resumed successfully with', this.waitingTimeRemaining, 'seconds remaining');
    } catch (error) {
      console.error('Error resuming waiting timer:', error);
      this.stopAllTimers();
      throw new Error('Failed to resume waiting timer: ' + error.message);
    }
  }

  // Resume all timers with their previously stored times
  resumeAllTimers() {
    try {
      console.log('Resuming all timers...');
      
      // Get the pause state
      const pauseState = this.getPauseState();
      
      // Get the socket module
      const socketModule = require('../socket/auctionSocket');
      
      // Emit current player information first
      if (this.auctionState.currentPlayer) {
        // Emit player update
        socketModule.emitPlayerUpdate({
          player: this.auctionState.currentPlayer,
          highestBid: this.auctionState.highestBid,
          highestBidder: this.auctionState.highestBidder
        });
        
        // Emit auction status
        socketModule.emitAuctionStatus({
          isRunning: true,
          isPaused: false,
          isWaiting: false,
          status: 'running',
          currentPlayer: {
            id: this.auctionState.currentPlayer.id || this.auctionState.currentPlayer._id,
            name: this.auctionState.currentPlayer.name,
            role: this.auctionState.currentPlayer.role,
            basePrice: this.auctionState.currentPlayer.base_price || this.auctionState.currentPlayer.basePrice
          },
          timeRemaining: pauseState.bidTimeRemaining,
          message: `Auction resumed for player ${this.auctionState.currentPlayer.name}`
        });
      }
      
      // Resume the appropriate timer based on which one was active
      if (pauseState.bidTimeRemaining > 0) {
        this.resumeBidTimer(() => {
          // Callback for when bid timer completes
          if (this.auctionState.currentPlayer) {
            const { finalizePlayerSale } = require('../controllers/auctionController');
            finalizePlayerSale(true);
          }
        });
      } else if (pauseState.waitingTimeRemaining > 0) {
        this.resumeWaitingTimer(() => {
          // Callback for when waiting timer completes
          const { fetchNextPlayer } = require('../controllers/auctionAdminController');
          fetchNextPlayer();
        });
      }
      
      console.log('All timers resumed successfully');
    } catch (error) {
      console.error('Error resuming all timers:', error);
      this.stopAllTimers();
      throw new Error('Failed to resume timers: ' + error.message);
    }
  }
}

module.exports = TimerManager; 