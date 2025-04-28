/**
 * Auction Front-end JavaScript
 * Contains utilities and functions for the auction interface
 */

// Default profile images based on player role
const DEFAULT_PLAYER_IMAGES = {
  'Batsman': '/images/default-batsman.png',
  'Bowler': '/images/default-bowler.png',
  'All-Rounder': '/images/default-all-rounder.png',
  'All-rounder': '/images/default-all-rounder.png',
  'Wicket-Keeper': '/images/default-wicket-keeper.png',
  'Wicket-keeper': '/images/default-wicket-keeper.png',
  'default': '/images/default-player.png'
};

// Get default player image based on role
function getDefaultPlayerImage(role) {
  return DEFAULT_PLAYER_IMAGES[role] || DEFAULT_PLAYER_IMAGES.default;
}

// Format currency (INR)
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Standardize player role display
function standardizeRoleDisplay(role) {
  if (!role) return '';
  
  // Capitalize first letter of each word
  role = role.toLowerCase();
  
  // Handle specific roles for consistent display
  if (role === 'all-rounder' || role === 'all rounder') {
    return 'All-Rounder';
  } else if (role === 'wicket-keeper' || role === 'wicket keeper') {
    return 'Wicket-Keeper';
  } else if (role === 'batsman') {
    return 'Batsman';
  } else if (role === 'bowler') {
    return 'Bowler';
  }
  
  // Default: capitalize each word
  return role.replace(/\b\w/g, char => char.toUpperCase());
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getDefaultPlayerImage,
    formatCurrency,
    standardizeRoleDisplay
  };
}

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
  socket.on('playerUpdate', (data) => {
    try {
      const { player, highestBid, highestBidder } = data;
      
      // Update player information in the UI
      updatePlayerInfo(player);
      
      // Update bid information
      updateBidInfo(highestBid, highestBidder);
      
      // Update player status
      updatePlayerStatus(player.status);
      
      console.log('Received player update:', {
        playerId: player.id,
        playerName: player.name,
        highestBid,
        highestBidder
      });
    } catch (error) {
      console.error('Error handling player update:', error);
    }
  });

  socket.on('auctionStatus', (data) => {
    try {
      const { isRunning, isPaused, isWaiting, currentPlayer, message } = data;
      
      // Update auction status UI
      updateAuctionStatus(isRunning, isPaused, isWaiting);
      
      // Update current player if provided
      if (currentPlayer) {
        updatePlayerInfo(currentPlayer);
      }
      
      // Show status message if provided
      if (message) {
        showStatusMessage(message);
      }
      
      console.log('Received auction status:', {
        isRunning,
        isPaused,
        isWaiting,
        currentPlayerId: currentPlayer?.id
      });
    } catch (error) {
      console.error('Error handling auction status:', error);
    }
  });

  // Helper functions
  function updatePlayerInfo(player) {
    const playerInfoContainer = document.getElementById('playerInfo');
    if (!playerInfoContainer) return;
    
    playerInfoContainer.innerHTML = `
      <div class="player-card">
        <img src="${player.image || 'default-player.jpg'}" alt="${player.name}" class="player-image">
        <div class="player-details">
          <h3>${player.name}</h3>
          <p>Role: ${player.role}</p>
          <p>Base Price: ${formatCurrency(player.basePrice)}</p>
          <p>Status: ${player.status}</p>
        </div>
      </div>
    `;
  }

  function updateBidInfo(highestBid, highestBidder) {
    const bidInfoContainer = document.getElementById('bidInfo');
    if (!bidInfoContainer) return;
    
    bidInfoContainer.innerHTML = `
      <div class="bid-details">
        <p>Highest Bid: ${formatCurrency(highestBid)}</p>
        <p>Highest Bidder: ${highestBidder || 'No bids yet'}</p>
      </div>
    `;
  }

  function updatePlayerStatus(status) {
    const statusElement = document.getElementById('playerStatus');
    if (!statusElement) return;
    
    statusElement.textContent = status;
    statusElement.className = `status-${status.toLowerCase()}`;
  }

  function updateAuctionStatus(isRunning, isPaused, isWaiting) {
    const statusContainer = document.getElementById('auctionStatus');
    if (!statusContainer) return;
    
    let statusText = 'Stopped';
    if (isRunning) statusText = 'Running';
    if (isPaused) statusText = 'Paused';
    if (isWaiting) statusText = 'Waiting';
    
    statusContainer.textContent = `Auction Status: ${statusText}`;
  }

  function showStatusMessage(message) {
    const messageContainer = document.getElementById('statusMessage');
    if (!messageContainer) return;
    
    messageContainer.textContent = message;
    messageContainer.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
      messageContainer.style.display = 'none';
    }, 5000);
  }
});
