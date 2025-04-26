// utils/timerManager.js

const { emitTimerUpdate, emitWaitingCountdown } = require('../socket/auctionSocket');

class TimerManager {
  constructor(auctionState) {
    this.auctionState = auctionState;
    this.bidTimer = null;
    this.waitingTimer = null;
    this.bidTimerDuration = 30; // 30 seconds for bidding
    this.waitingTimerDuration = 10; // 10 seconds between players
    this.timeRemaining = 0;
    this.waitingTimeRemaining = 0;
  }

  startBidTimer(callback) {
    if (this.bidTimer) {
      clearInterval(this.bidTimer);
    }
    
    this.timeRemaining = this.bidTimerDuration;
    emitTimerUpdate(this.timeRemaining);
    
    this.bidTimer = setInterval(() => {
      this.timeRemaining--;
      
      // Emit time update to all clients every second
      emitTimerUpdate(this.timeRemaining);
      
      if (this.timeRemaining <= 0) {
        this.stopBidTimer();
        if (callback) callback();
      }
    }, 1000);
  }

  stopBidTimer() {
    if (this.bidTimer) {
      clearInterval(this.bidTimer);
      this.bidTimer = null;
    }
  }

  startWaitingTimer(callback) {
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
    }
    
    this.waitingTimeRemaining = this.waitingTimerDuration;
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

  stopWaitingTimer() {
    if (this.waitingTimer) {
      clearInterval(this.waitingTimer);
      this.waitingTimer = null;
    }
  }

  stopAllTimers() {
    this.stopBidTimer();
    this.stopWaitingTimer();
  }

  resetTimers() {
    this.stopAllTimers();
    this.timeRemaining = 0;
    this.waitingTimeRemaining = 0;
  }

  getRemainingBidTime() {
    return this.timeRemaining;
  }

  getRemainingWaitingTime() {
    return this.waitingTimeRemaining;
  }
}

module.exports = TimerManager; 