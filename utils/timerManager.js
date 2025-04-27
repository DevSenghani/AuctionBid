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
  }

  startBidTimer(callback) {
    if (this.bidTimer) {
      clearInterval(this.bidTimer);
    }
    
    // Use stored time if coming from pause, otherwise use full duration
    if (this.pausedBidTimeRemaining !== null) {
      this.timeRemaining = this.pausedBidTimeRemaining;
      this.pausedBidTimeRemaining = null;
    } else {
      this.timeRemaining = this.bidTimerDuration;
    }
    
    this.bidStartTime = Date.now(); // Record when the timer started
    emitTimerUpdate(this.timeRemaining);
    
    this.bidTimer = setInterval(() => {
      this.timeRemaining--;
      
      // Emit time update to all clients every second
      emitTimerUpdate(this.timeRemaining);
      
      // Notify when time is getting low
      if (this.timeRemaining === 10) {
        // Get reference to auction state
        const currentState = this.auctionState;
        const io = require('../socket/auctionSocket').getIO();
        
        if (io && currentState) {
          io.to('auction').emit('bid-warning', {
            timeRemaining: this.timeRemaining,
            message: `Auction will ${currentState.highestBidder ? 'finalize to highest bidder' : 'mark player as UNSOLD'} in 10 seconds!`
          });
        }
      }
      
      if (this.timeRemaining <= 0) {
        this.stopBidTimer();
        if (callback) callback();
      }
    }, 1000);
  }

  pauseBidTimer() {
    if (this.bidTimer) {
      clearInterval(this.bidTimer);
      this.bidTimer = null;
      
      // Calculate exact time remaining
      const elapsed = Math.floor((Date.now() - this.bidStartTime) / 1000);
      this.pausedBidTimeRemaining = Math.max(0, this.bidTimerDuration - elapsed);
      
      // Emit pause status to clients
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
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
    }
    
    // Use stored time if coming from pause, otherwise use full duration
    if (this.pausedWaitingTimeRemaining !== null) {
      this.waitingTimeRemaining = this.pausedWaitingTimeRemaining;
      this.pausedWaitingTimeRemaining = null;
    } else {
      this.waitingTimeRemaining = this.waitingTimerDuration;
    }
    
    this.waitingStartTime = Date.now(); // Record when the timer started
    emitWaitingCountdown(this.waitingTimeRemaining);
    
    this.waitingTimer = setInterval(() => {
      this.waitingTimeRemaining--;
      
      // Emit waiting time update to all clients every second
      emitWaitingCountdown(this.waitingTimeRemaining);
      
      if (this.waitingTimeRemaining <= 0) {
        this.stopWaitingTimer();
        if (callback) callback();
      }
    }, 1000);
  }

  pauseWaitingTimer() {
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
      this.waitingTimer = null;
      
      // Calculate exact time remaining
      const elapsed = Math.floor((Date.now() - this.waitingStartTime) / 1000);
      this.pausedWaitingTimeRemaining = Math.max(0, this.waitingTimerDuration - elapsed);
      
      // Emit pause status to clients
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
    }
  }

  stopAllTimers() {
    this.stopBidTimer();
    this.stopWaitingTimer();
  }

  pauseAllTimers() {
    const bidTimeRemaining = this.pauseBidTimer();
    const waitingTimeRemaining = this.pauseWaitingTimer();
    return { bidTimeRemaining, waitingTimeRemaining };
  }

  resetTimers() {
    this.stopAllTimers();
    this.timeRemaining = 0;
    this.waitingTimeRemaining = 0;
    this.bidStartTime = null;
    this.waitingStartTime = null;
    this.pausedBidTimeRemaining = null;
    this.pausedWaitingTimeRemaining = null;
  }

  getRemainingBidTime() {
    // If paused, return the stored paused time
    if (this.pausedBidTimeRemaining !== null) {
      return this.pausedBidTimeRemaining;
    }
    
    // If the timer is running, calculate remaining time based on start time
    if (this.bidStartTime) {
      const elapsed = Math.floor((Date.now() - this.bidStartTime) / 1000);
      const remaining = Math.max(0, this.bidTimerDuration - elapsed);
      return remaining;
    }
    return this.timeRemaining;
  }

  getRemainingWaitingTime() {
    // If paused, return the stored paused time
    if (this.pausedWaitingTimeRemaining !== null) {
      return this.pausedWaitingTimeRemaining;
    }
    
    // If the timer is running, calculate remaining time based on start time
    if (this.waitingStartTime) {
      const elapsed = Math.floor((Date.now() - this.waitingStartTime) / 1000);
      const remaining = Math.max(0, this.waitingTimerDuration - elapsed);
      return remaining;
    }
    return this.waitingTimeRemaining;
  }
}

module.exports = TimerManager; 