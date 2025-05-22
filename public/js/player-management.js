document.addEventListener('DOMContentLoaded', function() {
  // Form elements
  const playerForm = document.getElementById('player-form');
  const playerNameInput = document.getElementById('player-name');
  const playerRoleInput = document.getElementById('player-role');
  const playerBasePriceInput = document.getElementById('player-base-price');
  const playerImageUrlInput = document.getElementById('player-image-url');
  const playerTeamInput = document.getElementById('player-team');
  const playerSoldPriceInput = document.getElementById('player-sold-price');
  const playerSoldPriceContainer = document.getElementById('player-sold-price-container');
  
  // Search and filter elements
  const playerSearchInput = document.getElementById('player-search');
  const playerFilterSelect = document.getElementById('player-filter');
  const refreshPlayersBtn = document.getElementById('refresh-players');
  
  // Table body
  const playersTableBody = document.getElementById('players-table-body');
  
  // Modals
  const assignPlayerModal = new bootstrap.Modal(document.getElementById('assignPlayerModal'));
  const editPlayerModal = new bootstrap.Modal(document.getElementById('editPlayerModal'));
  const importCsvModal = new bootstrap.Modal(document.getElementById('importCsvModal'));
  
  // Import/Export buttons
  const importPlayersBtn = document.getElementById('import-players-btn');
  const exportPlayersBtn = document.getElementById('export-players-btn');
  
  // Show/hide sold price field when team is selected
  if (playerTeamInput) {
    playerTeamInput.addEventListener('change', function() {
      if (this.value) {
        playerSoldPriceContainer.style.display = 'block';
      } else {
        playerSoldPriceContainer.style.display = 'none';
      }
    });
  }
  
  // Player form submission
  if (playerForm) {
    playerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData();
      formData.append('name', playerNameInput.value);
      formData.append('role', playerRoleInput.value);
      formData.append('base_price', playerBasePriceInput.value);
      
      // Handle image upload
      const imageFile = document.getElementById('player-image-upload').files[0];
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      // If team is selected, include team_id and sold_amount
      if (playerTeamInput.value) {
        formData.append('team_id', playerTeamInput.value);
        formData.append('sold_amount', playerSoldPriceInput.value || playerBasePriceInput.value);
      }
      
      try {
        const response = await fetch('/admin/players', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Reset form
          playerForm.reset();
          playerSoldPriceContainer.style.display = 'none';
          
          // Refresh player list
          loadPlayers();
          
          // Show success message
          showAlert('Player added successfully!', 'success');
        } else {
          throw new Error(result.message || 'Failed to create player');
        }
      } catch (error) {
        console.error('Error creating player:', error);
        showAlert('Error: ' + error.message, 'danger');
      }
    });
  }
  
  // Player search functionality
  if (playerSearchInput) {
    playerSearchInput.addEventListener('input', filterPlayers);
  }
  
  // Player filter functionality
  if (playerFilterSelect) {
    playerFilterSelect.addEventListener('change', filterPlayers);
  }
  
  // Refresh players button
  if (refreshPlayersBtn) {
    refreshPlayersBtn.addEventListener('click', loadPlayers);
  }
  
  // Import players button
  if (importPlayersBtn) {
    importPlayersBtn.addEventListener('click', function() {
      importCsvModal.show();
    });
  }
  
  // Export players button
  if (exportPlayersBtn) {
    exportPlayersBtn.addEventListener('click', exportPlayersToCSV);
  }
  
  // CSV import confirmation
  const importCsvBtn = document.getElementById('import-csv-btn');
  if (importCsvBtn) {
    importCsvBtn.addEventListener('click', function() {
      const fileInput = document.getElementById('csv-file');
      if (fileInput.files.length === 0) {
        showAlert('Please select a CSV file', 'warning');
        return;
      }
      
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const csvData = e.target.result;
        processCSV(csvData);
      };
      
      reader.readAsText(file);
    });
  }
  
  // Handle player actions
  document.addEventListener('click', function(e) {
    // Delete player
    if (e.target.classList.contains('delete-player-btn')) {
      const playerId = e.target.getAttribute('data-player-id');
      if (confirm('Are you sure you want to delete this player?')) {
        deletePlayer(playerId);
      }
    }
    
    // Edit player button
    else if (e.target.classList.contains('edit-player-btn')) {
      const btn = e.target;
      const playerId = btn.getAttribute('data-player-id');
      const playerName = btn.getAttribute('data-player-name');
      const playerRole = btn.getAttribute('data-player-role');
      const playerBasePrice = btn.getAttribute('data-player-base-price');
      const playerImageUrl = btn.getAttribute('data-player-image-url');
      
      // Populate edit form
      document.getElementById('edit-player-id').value = playerId;
      document.getElementById('edit-player-name').value = playerName;
      document.getElementById('edit-player-role').value = playerRole;
      document.getElementById('edit-player-base-price').value = playerBasePrice;
      document.getElementById('edit-player-image-url').value = playerImageUrl || '';
      
      // Show modal
      editPlayerModal.show();
    }
    
    // Assign player button
    else if (e.target.classList.contains('assign-player-btn')) {
      const playerId = e.target.getAttribute('data-player-id');
      const playerName = e.target.getAttribute('data-player-name');
      
      // Update modal title
      document.getElementById('assignPlayerModalLabel').textContent = `Assign ${playerName} to Team`;
      
      // Set player ID
      document.getElementById('assign-player-id').value = playerId;
      
      // Get player details to set default price
      fetch(`/admin/players/${playerId}`)
        .then(response => response.json())
        .then(data => {
          document.getElementById('assign-price').value = data.player.base_price;
        })
        .catch(error => {
          console.error('Error fetching player details:', error);
        });
      
      // Show modal
      assignPlayerModal.show();
    }
    
    // Reset player button
    else if (e.target.classList.contains('reset-player-btn')) {
      const playerId = e.target.getAttribute('data-player-id');
      if (confirm('Are you sure you want to reset this player\'s auction status?')) {
        resetPlayerAuction(playerId);
      }
    }
    
    // Start player auction button
    else if (e.target.classList.contains('start-player-auction-btn')) {
      const playerId = e.target.getAttribute('data-player-id');
      const playerName = e.target.getAttribute('data-player-name');
      
      if (confirm(`Start auction for ${playerName}?`)) {
        startPlayerAuction(playerId);
      }
    }
  });
  
  // Edit player form submission
  const confirmEditBtn = document.getElementById('confirm-edit-btn');
  if (confirmEditBtn) {
    confirmEditBtn.addEventListener('click', function() {
      const playerId = document.getElementById('edit-player-id').value;
      const playerData = {
        name: document.getElementById('edit-player-name').value,
        role: document.getElementById('edit-player-role').value,
        base_price: parseInt(document.getElementById('edit-player-base-price').value),
        image_url: document.getElementById('edit-player-image-url').value || null
      };
      
      // Send request to update player
      fetch(`/admin/players/${playerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(playerData)
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.error || 'Failed to update player') });
        }
        return response.json();
      })
      .then(data => {
        // Hide modal
        editPlayerModal.hide();
        
        // Refresh player list
        loadPlayers();
        
        // Show success message
        showAlert('Player updated successfully!', 'success');
      })
      .catch(error => {
        console.error('Error updating player:', error);
        showAlert('Error: ' + error.message, 'danger');
      });
    });
  }
  
  // Assign player form submission
  const confirmAssignBtn = document.getElementById('confirm-assign-btn');
  if (confirmAssignBtn) {
    confirmAssignBtn.addEventListener('click', function() {
      const playerId = document.getElementById('assign-player-id').value;
      const teamId = document.getElementById('assign-team').value;
      const price = parseInt(document.getElementById('assign-price').value);
      
      if (!teamId) {
        showAlert('Please select a team', 'warning');
        return;
      }
      
      // Send request to assign player
      fetch(`/admin/players/${playerId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          team_id: teamId,
          amount: price
        })
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.error || 'Failed to assign player') });
        }
        return response.json();
      })
      .then(data => {
        // Hide modal
        assignPlayerModal.hide();
        
        // Refresh player list
        loadPlayers();
        
        // Show success message
        showAlert('Player assigned to team successfully!', 'success');
      })
      .catch(error => {
        console.error('Error assigning player:', error);
        showAlert('Error: ' + error.message, 'danger');
      });
    });
  }
  
  // Load players function
  function loadPlayers() {
    fetch('/admin/players/all')
      .then(response => response.json())
      .then(data => {
        // Update player count
        const playerCount = document.getElementById('player-count');
        if (playerCount) {
          playerCount.textContent = data.players.length;
        }
        
        // Clear table body
        playersTableBody.innerHTML = '';
        
        // If no players, show message
        if (!data.players || data.players.length === 0) {
          playersTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No players available</td></tr>`;
          return;
        }
        
        // Populate table with players
        data.players.forEach(player => {
          const status = player.team_id ? 'sold' : (player.status === 'unsold' ? 'unsold' : 'available');
          
          // Standardize role display
          let displayRole = player.role;
          let roleClass = '';
          let roleIconClass = '';
          let roleIcon = '';
          
          if (player.role === 'Batsman') {
            roleClass = 'role-batsman';
            roleIconClass = 'role-icon-batsman';
            roleIcon = 'fas fa-baseball-ball';
          } else if (player.role === 'Bowler') {
            roleClass = 'role-bowler';
            roleIconClass = 'role-icon-bowler';
            roleIcon = 'fas fa-bowling-ball';
          } else if (player.role === 'All-rounder' || player.role === 'All-Rounder' || player.role === 'all-rounder') {
            roleClass = 'role-all-rounder';
            roleIconClass = 'role-icon-all-rounder';
            roleIcon = 'fas fa-running';
            displayRole = 'All-Rounder';
          } else if (player.role === 'Wicket-keeper' || player.role === 'Wicket-Keeper' || player.role === 'wicket-keeper') {
            roleClass = 'role-wicket-keeper';
            roleIconClass = 'role-icon-wicket-keeper';
            roleIcon = 'fas fa-hands';
            displayRole = 'Wicket-Keeper';
          } else {
            roleIcon = 'fas fa-user';
          }
          
          const row = document.createElement('tr');
          row.className = 'player-row';
          row.setAttribute('data-status', status);
          
          row.innerHTML = `
            <td>${player.name}</td>
            <td>
              <span class="${roleClass}">
                <span class="role-icon ${roleIconClass}">
                  <i class="${roleIcon}"></i>
                </span>
                ${displayRole}
              </span>
            </td>
            <td>${typeof player.base_price !== 'undefined' ? player.base_price.toLocaleString() : '0'}</td>
            <td>
              ${player.team_id 
                ? `<span class="badge bg-success">
                    <i class="fas fa-users me-1"></i>${player.team_name || 'Loading team...'}
                   </span>`
                : `<span class="badge bg-secondary">Unsold</span>`
              }
            </td>
            <td>
              ${player.sold_amount
                ? `<span class="badge bg-primary">
                    <i class="fas fa-rupee-sign me-1"></i>${player.sold_amount.toLocaleString()}
                   </span>`
                : player.team_id
                  ? `<span class="badge bg-info">
                      <i class="fas fa-rupee-sign me-1"></i>${player.base_price.toLocaleString()}
                     </span>`
                  : `<span class="badge bg-secondary">-</span>`
              }
            </td>
            <td>
              ${player.team_id
                ? `<button class="btn btn-sm btn-warning reset-player-btn" data-player-id="${player.id}">Reset</button>`
                : `<button class="btn btn-sm btn-primary assign-player-btn" data-player-id="${player.id}" data-player-name="${player.name}">Assign</button>
                   <button class="btn btn-sm btn-success start-player-auction-btn" data-player-id="${player.id}" data-player-name="${player.name}">
                     <i class="fas fa-gavel me-1"></i>Start Auction
                   </button>`
              }
              <button class="btn btn-sm btn-info edit-player-btn" data-player-id="${player.id}" 
                data-player-name="${player.name}" 
                data-player-role="${player.role}" 
                data-player-base-price="${player.base_price}"
                data-player-image-url="${player.image_url || ''}"
                data-player-status="${player.status}">
                <i class="fas fa-edit me-1"></i>Edit
              </button>
              <button class="btn btn-sm btn-danger delete-player-btn" data-player-id="${player.id}">Delete</button>
            </td>
          `;
          
          playersTableBody.appendChild(row);
        });
        
        // Apply current filter
        filterPlayers();
      })
      .catch(error => {
        console.error('Error loading players:', error);
        showAlert('Error loading players. Please try again.', 'danger');
      });
  }
  
  // Filter players function
  function filterPlayers() {
    const searchTerm = playerSearchInput ? playerSearchInput.value.toLowerCase() : '';
    const filterValue = playerFilterSelect ? playerFilterSelect.value : 'all';
    
    const rows = document.querySelectorAll('.player-row');
    
    rows.forEach(row => {
      const playerName = row.cells[0].textContent.toLowerCase();
      const status = row.getAttribute('data-status');
      
      // Check if player name matches search term
      const matchesSearch = playerName.includes(searchTerm);
      
      // Check if status matches filter
      const matchesFilter = filterValue === 'all' || status === filterValue;
      
      // Show/hide row based on matches
      if (matchesSearch && matchesFilter) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }
  
  // Delete player function
  function deletePlayer(playerId) {
    fetch(`/admin/players/${playerId}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || 'Failed to delete player') });
      }
      return response.json();
    })
    .then(data => {
      // Refresh player list
      loadPlayers();
      
      // Show success message
      showAlert('Player deleted successfully!', 'success');
    })
    .catch(error => {
      console.error('Error deleting player:', error);
      showAlert('Error: ' + error.message, 'danger');
    });
  }
  
  // Reset player auction function
  function resetPlayerAuction(playerId) {
    fetch(`/admin/players/${playerId}/reset`, {
      method: 'POST'
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || 'Failed to reset player') });
      }
      return response.json();
    })
    .then(data => {
      // Refresh player list
      loadPlayers();
      
      // Show success message
      showAlert('Player reset successfully!', 'success');
    })
    .catch(error => {
      console.error('Error resetting player:', error);
      showAlert('Error: ' + error.message, 'danger');
    });
  }
  
  // Start player auction function
  function startPlayerAuction(playerId) {
    fetch(`/admin/auction/player/${playerId}`, {
      method: 'POST'
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || 'Failed to start auction') });
      }
      return response.json();
    })
    .then(data => {
      // Show success message
      showAlert('Auction started for player!', 'success');
    })
    .catch(error => {
      console.error('Error starting auction:', error);
      showAlert('Error: ' + error.message, 'danger');
    });
  }
  
  // Process CSV function
  function processCSV(csvData) {
    // Split CSV into lines and parse headers
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    
    // Check required columns
    if (!headers.includes('name') || !headers.includes('role') || !headers.includes('base_price')) {
      showAlert('CSV file is missing required columns (name, role, base_price)', 'danger');
      return;
    }
    
    // Parse data rows
    const players = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = lines[i].split(',');
      const player = {};
      
      headers.forEach((header, index) => {
        player[header.trim()] = values[index] ? values[index].trim() : '';
      });
      
      // Convert numeric fields
      if (player.base_price) {
        player.base_price = parseInt(player.base_price);
      }
      
      players.push(player);
    }
    
    // Import players
    let importedCount = 0;
    let errorCount = 0;
    
    const importPromises = players.map(player => {
      return fetch('/admin/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(player)
      })
      .then(response => {
        if (!response.ok) {
          errorCount++;
          return;
        }
        importedCount++;
      })
      .catch(error => {
        errorCount++;
      });
    });
    
    Promise.all(importPromises)
      .then(() => {
        // Hide modal
        importCsvModal.hide();
        
        // Refresh player list
        loadPlayers();
        
        // Show result message
        showAlert(`Import complete! ${importedCount} players imported, ${errorCount} errors.`, importedCount > 0 ? 'success' : 'warning');
      });
  }
  
  // Export players to CSV function
  function exportPlayersToCSV() {
    fetch('/admin/players/all')
      .then(response => response.json())
      .then(data => {
        if (!data.players || data.players.length === 0) {
          showAlert('No players to export', 'warning');
          return;
        }
        
        // Create CSV header
        const headers = ['name', 'role', 'base_price', 'team_name', 'sold_amount', 'status', 'image_url'];
        let csvContent = headers.join(',') + '\n';
        
        // Add player data
        data.players.forEach(player => {
          const values = [
            `"${player.name || ''}"`,
            `"${player.role || ''}"`,
            player.base_price || 0,
            `"${player.team_name || ''}"`,
            player.sold_amount || 0,
            `"${player.status || 'available'}"`,
            `"${player.image_url || ''}"`
          ];
          
          csvContent += values.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'cricket_auction_players.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(error => {
        console.error('Error exporting players:', error);
        showAlert('Error exporting players. Please try again.', 'danger');
      });
  }
  
  // Show alert function
  function showAlert(message, type) {
    // Map alert types to Bootstrap color classes
    const typeMap = {
      'success': 'success',
      'danger': 'danger',
      'warning': 'warning',
      'info': 'info',
      'error': 'danger'
    };
    
    // Get the Bootstrap color class
    const bsType = typeMap[type] || 'info';
    
    // Create toast element
    const toastContainer = document.querySelector('.toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
      <div class="toast-header bg-${bsType} ${bsType === 'warning' ? 'text-dark' : 'text-white'}">
        <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
        <button type="button" class="btn-close ${bsType === 'warning' ? '' : 'btn-close-white'}" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;
    
    // Add to toast container
    toastContainer.appendChild(toast);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 5000);
  }
  
  // Initial load
  loadPlayers();
}); 