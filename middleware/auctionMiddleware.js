const auctionSocket = require('../socket/auctionSocket');

// Middleware to handle waiting period countdown
exports.waitingCountdown = (waitingTime = 10) => {
  let countdown = waitingTime;
  const intervalId = setInterval(() => {
    countdown--;
    // Emit the countdown to all clients
    auctionSocket.emitWaitingCountdown(countdown);
    
    if (countdown <= 0) {
      clearInterval(intervalId);
    }
  }, 1000);
  
  // Return reference to the interval so it can be cleared if needed
  return intervalId;
};

// Middleware to check if auction is running
exports.isAuctionRunning = (auctionState) => {
  return (req, res, next) => {
    if (!auctionState.isRunning) {
      return res.status(400).json({
        error: 'No auction is currently running',
        status: 'not_running'
      });
    }
    next();
  };
};

// Middleware to check if auction is not running
exports.isAuctionNotRunning = (auctionState) => {
  return (req, res, next) => {
    if (auctionState.isRunning && !auctionState.isPaused) {
      return res.status(400).json({
        error: 'Auction is already running',
        status: 'running'
      });
    }
    next();
  };
};

// Middleware to check if auction can be paused
exports.canPauseAuction = (auctionState) => {
  return (req, res, next) => {
    if (!auctionState.isRunning) {
      return res.status(400).json({
        error: 'Cannot pause: No auction is currently running',
        status: 'not_running'
      });
    }
    
    if (auctionState.isPaused) {
      return res.status(400).json({
        error: 'Auction is already paused',
        status: 'paused'
      });
    }
    
    next();
  };
};

// Middleware to check if auction can be ended
exports.canEndAuction = (auctionState) => {
  return (req, res, next) => {
    if (!auctionState.isRunning && !auctionState.isPaused) {
      return res.status(400).json({
        error: 'Cannot end: No auction is currently running or paused',
        status: 'not_running'
      });
    }
    
    next();
  };
};

// Middleware to validate auction state transitions
exports.validateStateTransition = (fromState, toState, auctionState) => {
  return (req, res, next) => {
    const currentState = auctionState.isPaused ? 'paused' : 
                         auctionState.isRunning ? 'running' : 'not_running';
    
    if (fromState !== currentState) {
      return res.status(400).json({
        error: `Invalid state transition: Current state is '${currentState}', expected '${fromState}'`,
        status: currentState
      });
    }
    
    next();
  };
}; 