/**
 * Admin Auction Control JavaScript
 * Handles client-side functionality for auction control in the admin dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const pauseAuctionBtn = document.getElementById('pause-auction-btn');
  const endAuctionBtn = document.getElementById('end-auction-btn');
  const startAuctionBtn = document.getElementById('start-auction-btn');
  const auctionStatusText = document.getElementById('auction-status-text');
  const auctionStatusMessage = document.getElementById('auction-status-message');
  const auctionPlayerCount = document.getElementById('auction-player-count');
  
  // Initialize socket connection for real-time updates
  const socket = io('', {
    auth: {
      isAdmin: true
    }
  });
  
  console.log('Admin auction controls initialized');
  
  // Fetch initial auction status
  fetchAuctionStatus();

  // Socket event listeners
  socket.on('connect', () => {
    console.log('Connected to socket server with ID:', socket.id);
    fetchAuctionStatus(); // Refresh status once connected
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from socket server');
  });
  
  // Listen for admin action events
  socket.on('admin-action', (data) => {
    console.log('Admin action received:', data);
    showAdminNotification(data.message, 
      data.action === 'pause_auction' ? 'warning' : 
      data.action === 'end_auction' ? 'danger' : 'info');
  });
  
  // Listen for auction state changes
  socket.on('auction-state-change', (data) => {
    console.log('Auction state change:', data);
    updateUIForStateChange(data.prevState, data.newState, data.reason);
  });
  
  // Listen for auction status updates
  socket.on('auction-status', (data) => {
    console.log('Auction status update:', data);
    updateAuctionStatus(data);
  });
  
  // Listen for auction notifications
  socket.on('auction-notification', (data) => {
    console.log('Auction notification:', data);
    showNotification(data.title, data.message, data.type);
  });
  
  // Listen for waiting countdown
  socket.on('waiting-countdown', (data) => {
    console.log('Waiting countdown:', data);
    if (auctionStatusMessage) {
      auctionStatusMessage.textContent = `Selecting next player in ${data.seconds} seconds...`;
    }
  });
  
  // Function to fetch current auction status
  function fetchAuctionStatus() {
    console.log('Fetching auction status...');
    fetch('/admin/auction/status')
      .then(response => response.json())
      .then(data => {
        console.log('Status received:', data);
        updateAuctionStatus(data);
      })
      .catch(error => {
        console.error('Error fetching auction status:', error);
      });
  }
  
  // Function to update UI based on auction status
  function updateAuctionStatus(data) {
    const status = data.status || (data.isPaused ? 'paused' : (data.isRunning ? 'running' : 'not_running'));
    
    if (status === 'running' || data.isRunning) {
      startAuctionBtn.disabled = true;
      pauseAuctionBtn.disabled = false;
      endAuctionBtn.disabled = false;
      
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Running';
        auctionStatusText.className = 'text-success';
      }
    } else if (status === 'paused' || data.isPaused) {
      startAuctionBtn.disabled = false;
      pauseAuctionBtn.disabled = true;
      endAuctionBtn.disabled = false;
      
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Paused';
        auctionStatusText.className = 'text-warning';
      }
    } else {
      startAuctionBtn.disabled = false;
      pauseAuctionBtn.disabled = true;
      endAuctionBtn.disabled = true;
      
      if (auctionStatusText) {
        auctionStatusText.textContent = status === 'ended' ? 'Ended' : 'Not Running';
        auctionStatusText.className = 'text-secondary';
      }
    }
    
    // Update status message if available
    if (auctionStatusMessage && data.message) {
      auctionStatusMessage.textContent = data.message;
    }
    
    // Update player count if available
    if (auctionPlayerCount && data.availablePlayerCount !== undefined) {
      auctionPlayerCount.textContent = `${data.availablePlayerCount} Players Available`;
    }
    
    // Update current player card if available
    const currentPlayerCard = document.getElementById('current-player-card');
    if (currentPlayerCard) {
      if (data.currentPlayer) {
        currentPlayerCard.classList.remove('d-none');
        
        const playerNameElem = document.getElementById('current-player-name');
        const playerRoleElem = document.getElementById('current-player-role');
        const playerBasePriceElem = document.getElementById('current-player-base-price');
        
        if (playerNameElem) playerNameElem.textContent = data.currentPlayer.name;
        if (playerRoleElem) playerRoleElem.textContent = data.currentPlayer.role;
        if (playerBasePriceElem) {
          const basePrice = data.currentPlayer.basePrice || data.currentPlayer.base_price || 0;
          playerBasePriceElem.textContent = new Intl.NumberFormat('en-IN').format(basePrice);
        }
        
        // Update timer elements if available
        const timeRemainingElem = document.getElementById('time-remaining');
        const timeProgressElem = document.getElementById('time-progress');
        
        if (timeRemainingElem && data.timeRemaining !== undefined) {
          timeRemainingElem.textContent = `${data.timeRemaining}s`;
        }
        
        if (timeProgressElem && data.timeRemaining !== undefined) {
          const progressPercent = (data.timeRemaining / 60) * 100;
          timeProgressElem.style.width = `${progressPercent}%`;
          
          // Update progress bar color based on time remaining
          if (progressPercent > 60) {
            timeProgressElem.className = 'progress-bar progress-bar-striped progress-bar-animated bg-success';
          } else if (progressPercent > 30) {
            timeProgressElem.className = 'progress-bar progress-bar-striped progress-bar-animated bg-warning';
          } else {
            timeProgressElem.className = 'progress-bar progress-bar-striped progress-bar-animated bg-danger';
          }
        }
      } else {
        currentPlayerCard.classList.add('d-none');
      }
    }
  }
  
  // Function to handle pausing the auction
  function pauseAuction(reason = '') {
    // Set button loading state
    pauseAuctionBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Pausing...';
    pauseAuctionBtn.disabled = true;
    
    // Make API request to pause the auction
    fetch('/admin/auction/pause', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to pause auction');
        });
      }
      return response.json();
    })
    .then(data => {
      // Show success notification
      showNotification('Auction Paused', data.message, 'warning');
      
      // Check for database status
      if (data.dbStatus === 'using mock data') {
        showNotification('Database Notice', 'Database connection could not be established. Using mock data for demonstration.', 'info', 8000);
      }
      
      // Reset button
      pauseAuctionBtn.innerHTML = '<i class="fas fa-pause-circle me-2"></i>Pause Auction';
      pauseAuctionBtn.disabled = true;
      
      // Enable start button (which acts as resume when paused)
      startAuctionBtn.disabled = false;
      endAuctionBtn.disabled = false;
      
      // Update status text
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Paused';
        auctionStatusText.className = 'text-warning';
      }
    })
    .catch(error => {
      // Show error notification
      showNotification('Error', error.message, 'danger');
      
      // Reset button
      pauseAuctionBtn.innerHTML = '<i class="fas fa-pause-circle me-2"></i>Pause Auction';
      pauseAuctionBtn.disabled = false;
    });
  }
  
  // Function to handle ending the auction
  function endAuction() {
    // Confirm with user
    if (!confirm('Are you sure you want to end the auction? This action cannot be undone.')) {
      return;
    }
    
    // Set button loading state
    endAuctionBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Ending...';
    endAuctionBtn.disabled = true;
    
    // Optional reason
    const reason = prompt('You may provide a reason for ending the auction (optional):');
    
    // Make API request to end the auction
    fetch('/admin/auction/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: reason || '' })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to end auction');
        });
      }
      return response.json();
    })
    .then(data => {
      // Check for database connection issues
      if (data.dbStatus === 'using mock data' || data.dbStatus === 'error' || data.warning) {
        showNotification('Database Notice', 'Database connection could not be established. Using mock data for demonstration.', 'info', 8000);
      }
      
      // Show success notification
      showNotification('Auction Ended', data.message, 'success');
      
      // Reset button
      endAuctionBtn.innerHTML = '<i class="fas fa-stop-circle me-2"></i>End Auction';
      
      // Disable auction control buttons
      startAuctionBtn.disabled = false;
      pauseAuctionBtn.disabled = true;
      endAuctionBtn.disabled = true;
      
      // Update status text
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Ended';
        auctionStatusText.className = 'text-danger';
      }
      
      // Show summary if available
      if (data.summary) {
        // Format the summary data into HTML
        let summaryContent = `
          <div class="summary-stats">
            <p><strong>Total Players Sold:</strong> ${data.summary.totalSold || 0}</p>
            <p><strong>Total Unsold:</strong> ${data.summary.totalUnsold || 0}</p>
            <p><strong>Total Amount:</strong> ₹${data.summary.totalAmount?.toLocaleString() || 0}</p>
          </div>
        `;
        
        if (data.summary.highestBid) {
          summaryContent += `
            <div class="mt-3">
              <h6>Highest Bid</h6>
              <p>${data.summary.highestBid.player} - ₹${data.summary.highestBid.amount?.toLocaleString() || 0} (${data.summary.highestBid.team})</p>
            </div>
          `;
        }
        
        showSummaryModal('Auction Summary', summaryContent);
      }
    })
    .catch(error => {
      // Show error notification
      showNotification('Error', error.message, 'danger');
      
      // Reset button
      endAuctionBtn.innerHTML = '<i class="fas fa-stop-circle me-2"></i>End Auction';
      endAuctionBtn.disabled = false;
    });
  }
  
  // Update UI based on state change
  function updateUIForStateChange(prevState, newState, reason) {
    console.log(`Auction state changed: ${prevState} -> ${newState}`);
    
    // Update button states based on new state
    if (newState === 'running') {
      startAuctionBtn.disabled = true;
      pauseAuctionBtn.disabled = false;
      endAuctionBtn.disabled = false;
      
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Running';
        auctionStatusText.className = 'text-success';
      }
    } else if (newState === 'paused') {
      startAuctionBtn.disabled = false;
      pauseAuctionBtn.disabled = true;
      endAuctionBtn.disabled = false;
      
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Paused';
        auctionStatusText.className = 'text-warning';
      }
    } else { // not_running or ended
      startAuctionBtn.disabled = false;
      pauseAuctionBtn.disabled = true;
      endAuctionBtn.disabled = true;
      
      if (auctionStatusText) {
        auctionStatusText.textContent = newState === 'ended' ? 'Ended' : 'Not Running';
        auctionStatusText.className = 'text-secondary';
      }
    }
  }
  
  // Show notification for admin actions
  function showAdminNotification(message, type = 'info') {
    const alertContainer = document.createElement('div');
    alertContainer.className = 'position-fixed top-50 start-50 translate-middle';
    alertContainer.style.zIndex = '9999';
    
    alertContainer.innerHTML = `
      <div class="alert alert-${type} shadow-lg" role="alert">
        <div class="d-flex align-items-center">
          <i class="fas fa-${type === 'info' ? 'info-circle' : 
                           type === 'warning' ? 'exclamation-triangle' : 
                           type === 'danger' ? 'exclamation-circle' : 
                           'check-circle'} me-2 fs-4"></i>
          <div>${message}</div>
        </div>
        <button type="button" class="btn-close position-absolute top-0 end-0 m-2" data-bs-dismiss="alert"></button>
      </div>
    `;
    
    document.body.appendChild(alertContainer);
    
    // Add event listener to close button
    const closeBtn = alertContainer.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        alertContainer.remove();
      });
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(alertContainer)) {
        alertContainer.remove();
      }
    }, 5000);
  }
  
  // Show toast notification
  function showNotification(title, message, type = 'info', duration = 5000) {
    const existingToasts = document.querySelectorAll('.toast');
    const toastOffset = existingToasts.length * 10;
    
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1080';
    toastContainer.style.marginTop = `${toastOffset}px`;
    
    const toast = document.createElement('div');
    toast.className = `toast show bg-${type} text-white`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
      <div class="toast-header bg-${type} text-white">
        <strong class="me-auto">${title}</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;
    
    toastContainer.appendChild(toast);
    document.body.appendChild(toastContainer);
    
    // Automatically remove the toast after duration
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toastContainer);
      }, 300);
    }, duration);
    
    // Handle close button click
    const closeBtn = toast.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
          document.body.removeChild(toastContainer);
        }, 300);
      });
    }
  }
  
  // Show a modal with auction summary
  function showSummaryModal(title, content) {
    // Create modal element
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal fade';
    modalContainer.id = 'summaryModal';
    modalContainer.tabIndex = '-1';
    modalContainer.setAttribute('aria-labelledby', 'summaryModalLabel');
    modalContainer.setAttribute('aria-hidden', 'true');
    
    modalContainer.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="summaryModalLabel">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // Show the modal
    const modal = new bootstrap.Modal(modalContainer);
    modal.show();
    
    // Remove modal when hidden
    modalContainer.addEventListener('hidden.bs.modal', function () {
      modalContainer.remove();
    });
  }
  
  // Add event listeners to buttons
  if (pauseAuctionBtn) {
    pauseAuctionBtn.addEventListener('click', () => {
      const reason = prompt('You may provide a reason for pausing the auction (optional):');
      pauseAuction(reason || '');
    });
  }
  
  if (endAuctionBtn) {
    endAuctionBtn.addEventListener('click', endAuction);
  }
  
  // Function to handle starting the auction
  function startAuction() {
    // Set button loading state
    startAuctionBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Starting...';
    startAuctionBtn.disabled = true;
    
    // Make API request to start the auction
    fetch('/admin/auction/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'same-origin' // Include cookies for session
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || data.message || 'Failed to start auction');
        });
      }
      return response.json();
    })
    .then(data => {
      // Show success notification
      showNotification('Auction Started', data.message || 'Auction has been started successfully', 'success');
      
      // Reset button
      startAuctionBtn.innerHTML = '<i class="fas fa-play-circle me-2"></i>Start Auction';
      startAuctionBtn.disabled = true;
      
      // Enable pause and end buttons
      pauseAuctionBtn.disabled = false;
      endAuctionBtn.disabled = false;
      
      // Update status text
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Running';
        auctionStatusText.className = 'text-success';
      }
    })
    .catch(error => {
      console.error('Error starting auction:', error);
      
      // Show error notification
      showNotification('Error', error.message || 'Failed to start auction', 'danger');
      
      // Reset button
      startAuctionBtn.innerHTML = '<i class="fas fa-play-circle me-2"></i>Start Auction';
      startAuctionBtn.disabled = false;
    });
  }
  
  // Add event listener for start auction button
  if (startAuctionBtn) {
    startAuctionBtn.addEventListener('click', startAuction);
  }
}); 