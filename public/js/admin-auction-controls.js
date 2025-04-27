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
  
  // Socket connection for real-time updates
  const socket = io('', {
    auth: {
      isAdmin: true
    }
  });
  
  // Listen for admin action events
  socket.on('admin-action', (data) => {
    showAdminNotification(data.message, 
      data.action === 'pause_auction' ? 'warning' : 
      data.action === 'end_auction' ? 'danger' : 'info');
  });
  
  // Listen for auction state changes
  socket.on('auction-state-change', (data) => {
    updateUIForStateChange(data.prevState, data.newState, data.reason);
  });
  
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
    // Confirm before ending
    if (!confirm('Are you sure you want to end the auction? This action cannot be undone.')) {
      return;
    }
    
    // Prompt for reason
    const reason = prompt('You may provide a reason for ending the auction (optional):');
    
    // Set button loading state
    endAuctionBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Ending...';
    endAuctionBtn.disabled = true;
    
    // Make API request to end the auction
    fetch('/admin/auction/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
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
      // Show success notification
      showNotification('Auction Ended', data.message, 'info');
      
      // Show summary if available
      if (data.summary) {
        const summaryHtml = `
          <div class="mt-3 p-3 border rounded bg-light">
            <h5>Auction Summary</h5>
            <p><strong>Players Sold:</strong> ${data.summary.soldPlayers}</p>
            <p><strong>Total Amount:</strong> ₹${new Intl.NumberFormat('en-IN').format(data.summary.totalAmount)}</p>
            <p><strong>Teams Participated:</strong> ${data.summary.teamsParticipated}</p>
          </div>
        `;
        
        // Create and show the modal
        showSummaryModal('Auction Summary', summaryHtml);
      }
      
      // Reset buttons
      endAuctionBtn.innerHTML = '<i class="fas fa-stop-circle me-2"></i>End Auction';
      endAuctionBtn.disabled = true;
      pauseAuctionBtn.disabled = true;
      startAuctionBtn.disabled = false;
      
      // Update status text
      if (auctionStatusText) {
        auctionStatusText.textContent = 'Ended';
        auctionStatusText.className = 'text-secondary';
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
  function showNotification(title, message, type = 'info') {
    const toastContainer = document.createElement('div');
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '5000';
    
    toastContainer.innerHTML = `
      <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header bg-${type} ${type === 'warning' ? 'text-dark' : 'text-white'}">
          <strong class="me-auto">${title}</strong>
          <button type="button" class="btn-close ${type !== 'warning' ? 'btn-close-white' : ''}" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    
    document.body.appendChild(toastContainer);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      toastContainer.remove();
    }, 5000);
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
}); 