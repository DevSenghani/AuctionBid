document.addEventListener('DOMContentLoaded', () => {
  // Root container in your HTML page must have id="auction-page"
  const pageContainer = document.getElementById('auction-page');
  if (!pageContainer) {
    console.error('Missing <div id="auction-page"></div> in your HTML.');
    return;
  }

  // Title
  const title = document.createElement('h1');
  title.textContent = 'Live Auction';
  pageContainer.appendChild(title);

  // Container for all auctions
  const listContainer = document.createElement('div');
  listContainer.id = 'auctions-container';
  pageContainer.appendChild(listContainer);

  // Fetch and render auction items
  fetch('/api/auctions')
    .then(res => res.json())
    .then(auctions => {
      if (!Array.isArray(auctions) || auctions.length === 0) {
        listContainer.textContent = 'No auctions available at the moment.';
        return;
      }

      auctions.forEach(auction => {
        const card = document.createElement('div');
        card.className = 'auction-card';
        card.innerHTML = `
          <h2>${auction.title}</h2>
          <p>${auction.description}</p>
          <p>Current Bid: $<span class="current-bid">${auction.currentBid.toFixed(2)}</span></p>
          <form class="bid-form" data-id="${auction.id}">
            <input
              type="number"
              name="bid"
              min="${(auction.currentBid + 1).toFixed(2)}"
              step="0.01"
              placeholder="Your bid"
              required
            />
            <button type="submit">Place Bid</button>
          </form>
          <div class="bid-message" aria-live="polite"></div>
        `;
        listContainer.appendChild(card);

        // Handle bid submission
        const form = card.querySelector('.bid-form');
        form.addEventListener('submit', e => {
          e.preventDefault();
          const bidValue = parseFloat(form.bid.value);
          placeBid(auction.id, bidValue, card);
        });
      });
    })
    .catch(err => {
      console.error('Error fetching auctions:', err);
      listContainer.textContent = 'Failed to load auctions. Please try again later.';
    });

  // Send bid to server and update UI
  function placeBid(auctionId, amount, card) {
    const messageDiv = card.querySelector('.bid-message');
    fetch(`/api/auctions/${auctionId}/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bid: amount })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          card.querySelector('.current-bid').textContent = amount.toFixed(2);
          messageDiv.textContent = 'Bid placed successfully!';
        } else {
          messageDiv.textContent = result.error || 'Could not place bid.';
        }
      })
      .catch(err => {
        console.error('Error placing bid:', err);
        messageDiv.textContent = 'An error occurred. Please try again.';
      });
  }

  // Timer handling functions
  function startDynamicTimer(initialTime, timerElement, timeProgressElement = null) {
    // Clear any existing timer
    if (window.timerInterval) {
      clearInterval(window.timerInterval);
    }
    
    let timeRemaining = initialTime;
    let timerStart = Date.now();
    
    // Update timer display immediately
    updateTimerDisplay(timeRemaining, timerElement, timeProgressElement);
    
    // Set up the interval to update every second
    window.timerInterval = setInterval(() => {
      // Calculate elapsed time since timer started
      const elapsed = Math.floor((Date.now() - timerStart) / 1000);
      timeRemaining = Math.max(0, initialTime - elapsed);
      
      // Update the display
      updateTimerDisplay(timeRemaining, timerElement, timeProgressElement);
      
      // If timer reaches zero, clear the interval
      if (timeRemaining <= 0) {
        clearInterval(window.timerInterval);
      }
    }, 1000);
  }

  function updateTimerDisplay(timeRemaining, timerElement, timeProgressElement) {
    // Update the timer text
    if (timerElement) {
      timerElement.textContent = timeRemaining + 's';
    }
    
    // Update progress bar if provided
    if (timeProgressElement) {
      const progressPercent = (timeRemaining / 60) * 100;
      timeProgressElement.style.width = `${progressPercent}%`;
      
      // Update progress bar color based on time remaining
      if (progressPercent > 60) {
        timeProgressElement.className = 'progress-bar bg-success';
      } else if (progressPercent > 30) {
        timeProgressElement.className = 'progress-bar bg-warning';
      } else {
        timeProgressElement.className = 'progress-bar bg-danger';
      }
    }
  }

  // Socket event handlers
  socket.on('auction-status', (data) => {
    console.log('Auction status update received:', data);
    
    // Get timer elements
    const bidTimer = document.getElementById('bid-timer');
    const timeProgress = document.getElementById('time-progress');
    
    // Handle timers based on auction status
    if (data.isRunning && !data.isPaused) {
      if (data.isWaiting) {
        // Initialize waiting timer
        const waitingTime = data.timeRemaining || 10;
        
        // Get waiting message elements
        const waitingMessage = document.querySelector('.waiting-message h4');
        if (waitingMessage) {
          waitingMessage.textContent = `Next player in ${waitingTime}s`;
        }
        
        // Start a dynamic countdown
        startDynamicTimer(waitingTime, document.getElementById('waiting-countdown'));
      } else if (data.currentPlayer) {
        // Initialize bidding timer
        const biddingTime = data.timeRemaining || 30;
        startDynamicTimer(biddingTime, bidTimer, timeProgress);
      }
    } else if (data.isPaused) {
      // Show paused state
      if (bidTimer) {
        bidTimer.textContent = "PAUSED";
        bidTimer.classList.add('text-warning');
      }
      
      if (timeProgress) {
        timeProgress.className = 'progress-bar bg-warning';
      }
    }
  });

  // Handle timer updates 
  socket.on('timer-update', (data) => {
    console.log('Timer update received:', data);
    
    // Get timer elements
    const bidTimer = document.getElementById('bid-timer');
    const timeProgress = document.getElementById('time-progress');
    
    if (data.isPaused) {
      // Show paused state
      if (bidTimer) {
        bidTimer.textContent = "PAUSED";
        bidTimer.classList.add('text-warning');
      }
      
      if (timeProgress) {
        timeProgress.className = 'progress-bar bg-warning';
      }
    } else {
      // Calculate accurate time based on timestamp
      const serverTimestamp = data.timestamp;
      const clientTimestamp = Date.now();
      const timeDiff = Math.floor((clientTimestamp - serverTimestamp) / 1000);
      
      // Adjust remaining time based on network delay
      const adjustedTime = Math.max(0, data.timeRemaining - timeDiff);
      
      // Update the timer display
      startDynamicTimer(adjustedTime, bidTimer, timeProgress);
    }
  });

  // Handle waiting timer updates
  socket.on('waiting-countdown', (data) => {
    console.log('Waiting countdown update received:', data);
    
    // Get waiting message elements
    const waitingMessage = document.querySelector('.waiting-message h4');
    const waitingCountdown = document.getElementById('waiting-countdown');
    
    if (data.isPaused) {
      // Show paused state
      if (waitingMessage) {
        waitingMessage.textContent = "Waiting - PAUSED";
        waitingMessage.classList.add('text-warning');
      }
    } else {
      // Calculate accurate time based on timestamp
      const serverTimestamp = data.timestamp;
      const clientTimestamp = Date.now();
      const timeDiff = Math.floor((clientTimestamp - serverTimestamp) / 1000);
      
      // Adjust remaining time based on network delay
      const adjustedTime = Math.max(0, data.seconds - timeDiff);
      
      // Update waiting message text
      if (waitingMessage) {
        waitingMessage.textContent = `Next player in ${adjustedTime}s`;
      }
      
      // Update the countdown display
      if (waitingCountdown) {
        startDynamicTimer(adjustedTime, waitingCountdown);
      }
    }
  });
});
