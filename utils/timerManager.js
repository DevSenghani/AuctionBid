// utils/timerManager.js

const { emitTimerUpdate, emitWaitingCountdown } = require('../socket/auctionSocket');

class TimerManager {
  constructor(auctionState) {
    this.auctionState = auctionState;
    this.bidTimer = null;
    this.waitingTimer = null;
    this.bidTimerDuration = 60; // 60 seconds for bidding
    this.waitingTimerDuration = 10; // 10 seconds between players
    this.timeRemaining = 0;
    this.waitingTimeRemaining = 0;
    this.bidStartTime = null; // Timestamp when bid timer started
    this.waitingStartTime = null; // Timestamp when waiting timer started
    this.pausedBidTimeRemaining = null; // Store remaining time when paused
    this.pausedWaitingTimeRemaining = null; // Store remaining time when paused
    
    // Set up interval for emitting regular updates (every 1 second)
    this.updateInterval = null;
    this.setupUpdateInterval();
  }
  
  // Set up an interval to send regular timer updates to clients
  setupUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Emit timer updates every second
    this.updateInterval = setInterval(() => {
      this.emitTimerUpdates();
    }, 1000);
  }
  
  // Function to emit real-time timer updates
  emitTimerUpdates() {
    try {
      // Only emit if the timers are running
      if (this.bidTimer) {
        emitTimerUpdate(this.timeRemaining, false);
      } else if (this.waitingTimer) {
        emitWaitingCountdown(this.waitingTimeRemaining, false);
      } else if (this.pausedBidTimeRemaining !== null) {
        emitTimerUpdate(this.pausedBidTimeRemaining, true);
      } else if (this.pausedWaitingTimeRemaining !== null) {
        emitWaitingCountdown(this.pausedWaitingTimeRemaining, true);
      }
    } catch (error) {
      console.error('Error emitting timer updates:', error);
    }
  }

  startBidTimer(callback) {
    try {
      console.log('Starting bid timer...');
      
      // Clear any existing timers
      this.stopAllTimers();
      
      // Set initial bid time (30 seconds)
      this.timeRemaining = 30;
      this.bidStartTime = Date.now();
      
      // Start the timer
      this.bidTimer = setInterval(() => {
        this.timeRemaining--;
        
        // Emit remaining time to all clients
        const io = require('../socket/auctionSocket').getIO();
        if (io) {
          io.to('auction').emit('bid-time-update', {
            timeRemaining: this.timeRemaining,
            timestamp: Date.now()
          });
        }
        
        // When timer reaches 0
        if (this.timeRemaining <= 0) {
          this.stopBidTimer();
          if (callback) {
            callback();
          }
        }
      }, 1000);
      
      console.log('Bid timer started successfully');
    } catch (error) {
      console.error('Error starting bid timer:', error);
      this.stopAllTimers();
      throw new Error('Failed to start bid timer: ' + error.message);
    }
  }

  pauseBidTimer() {
    if (this.bidTimer) {
      clearInterval(this.bidTimer);
      this.bidTimer = null;
      
      // Calculate exact time remaining
      const elapsed = Math.floor((Date.now() - this.bidStartTime) / 1000);
      this.pausedBidTimeRemaining = Math.max(0, this.bidTimerDuration - elapsed);
      
      // Emit pause status to clients with timestamp
      const { emitTimerUpdate } = require('../socket/auctionSocket');
      emitTimerUpdate(this.pausedBidTimeRemaining, true);
      
      this.bidStartTime = null;
      return this.pausedBidTimeRemaining;
    }
    return 0;
  }

  stopBidTimer() {
    if (this.bidTimer) {
      clearInterval(this.bidTimer);
      this.bidTimer = null;
      this.bidStartTime = null;
      this.pausedBidTimeRemaining = null;
    }
  }

  startWaitingTimer(callback) {
    try {
      console.log('Starting waiting timer...');
      
      // Clear any existing timers
      this.stopAllTimers();
      
      // Set initial waiting time (10 seconds)
      this.waitingTimeRemaining = 10;
      this.waitingStartTime = Date.now();
      
      // Start the timer
      this.waitingTimer = setInterval(() => {
        this.waitingTimeRemaining--;
        
        // Emit remaining time to all clients
        const io = require('../socket/auctionSocket').getIO();
        if (io) {
          io.to('auction').emit('waiting-time-update', {
            timeRemaining: this.waitingTimeRemaining,
            timestamp: Date.now()
          });
        }
        
        // When timer reaches 0
        if (this.waitingTimeRemaining <= 0) {
          this.stopWaitingTimer();
          if (callback) {
            callback();
          }
        }
      }, 1000);
      
      console.log('Waiting timer started successfully');
    } catch (error) {
      console.error('Error starting waiting timer:', error);
      this.stopAllTimers();
      throw new Error('Failed to start waiting timer: ' + error.message);
    }
  }

  pauseWaitingTimer() {
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
      this.waitingTimer = null;
      
      // Calculate exact time remaining
      const elapsed = Math.floor((Date.now() - this.waitingStartTime) / 1000);
      this.pausedWaitingTimeRemaining = Math.max(0, this.waitingTimerDuration - elapsed);
      
      // Emit pause status to clients with timestamp
      const { emitWaitingCountdown } = require('../socket/auctionSocket');
      emitWaitingCountdown(this.pausedWaitingTimeRemaining, true);
      
      this.waitingStartTime = null;
      return this.pausedWaitingTimeRemaining;
    }
    return 0;
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
      
      // Start the timer
      this.bidTimer = setInterval(() => {
        this.timeRemaining--;
        
        // Emit remaining time to all clients
        const io = require('../socket/auctionSocket').getIO();
        if (io) {
          io.to('auction').emit('bid-time-update', {
            timeRemaining: this.timeRemaining,
            timestamp: Date.now()
          });
        }
        
        // When timer reaches 0
        if (this.timeRemaining <= 0) {
          this.stopBidTimer();
          if (callback) {
            callback();
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
      
      // Start the timer
      this.waitingTimer = setInterval(() => {
        this.waitingTimeRemaining--;
        
        // Emit remaining time to all clients
        const io = require('../socket/auctionSocket').getIO();
        if (io) {
          io.to('auction').emit('waiting-time-update', {
            timeRemaining: this.waitingTimeRemaining,
            timestamp: Date.now()
          });
        }
        
        // When timer reaches 0
        if (this.waitingTimeRemaining <= 0) {
          this.stopWaitingTimer();
          if (callback) {
            callback();
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
      
      // Emit current player information first
      if (this.auctionState.currentPlayer) {
        const { emitPlayerUpdate, emitAuctionStatus } = require('../socket/auctionSocket');
        
        // Emit player update
        emitPlayerUpdate({
          player: this.auctionState.currentPlayer,
          highestBid: this.auctionState.highestBid,
          highestBidder: this.auctionState.highestBidder
        });
        
        // Emit auction status
        emitAuctionStatus({
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