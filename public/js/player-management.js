document.addEventListener('DOMContentLoaded', function() {
  // Constants for player roles and statuses
  const PLAYER_ROLES = {
    BATSMAN: 'Batsman',
    BOWLER: 'Bowler', 
    ALL_ROUNDER: 'All-Rounder',
    WICKET_KEEPER: 'Wicket-Keeper'
  };

  const PLAYER_STATUSES = {
    AVAILABLE: 'available',
    SOLD: 'sold',
    UNSOLD: 'unsold',
    IN_AUCTION: 'in_auction'
  };

  // Role display configuration for consistent styling
  const ROLE_DISPLAY_CONFIG = {
    [PLAYER_ROLES.BATSMAN]: {
      displayName: PLAYER_ROLES.BATSMAN,
      roleClass: 'role-batsman',
      iconClass: 'role-icon-batsman',
      icon: 'fas fa-baseball-ball'
    },
    [PLAYER_ROLES.BOWLER]: {
      displayName: PLAYER_ROLES.BOWLER,
      roleClass: 'role-bowler',
      iconClass: 'role-icon-bowler',
      icon: 'fas fa-bowling-ball'
    },
    [PLAYER_ROLES.ALL_ROUNDER]: {
      displayName: PLAYER_ROLES.ALL_ROUNDER,
      roleClass: 'role-all-rounder',
      iconClass: 'role-icon-all-rounder',
      icon: 'fas fa-running'
    },
    [PLAYER_ROLES.WICKET_KEEPER]: {
      displayName: PLAYER_ROLES.WICKET_KEEPER,
      roleClass: 'role-wicket-keeper',
      iconClass: 'role-icon-wicket-keeper',
      icon: 'fas fa-hands'
    }
  };

  // API endpoints
  const API = {
    PLAYERS: '/admin/players',
    PLAYER_BY_ID: (id) => `/admin/players/${id}`,
    PLAYER_IMAGE: (id) => `/admin/players/${id}/image`,
    PLAYER_ASSIGN: (id) => `/admin/players/${id}/assign`,
    PLAYER_RESET: (id) => `/admin/players/${id}/reset`,
    START_AUCTION: (id) => `/admin/auction/player/${id}`
  };

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
      playerSoldPriceContainer.style.display = this.value ? 'block' : 'none';
    });
  }
  
  // Player form submission
  if (playerForm) {
    playerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (!validateForm('add')) {
        return;
      }
      
      const playerData = {
        name: playerNameInput.value,
        role: playerRoleInput.value,
        base_price: parseInt(playerBasePriceInput.value)
      };
      
      // If team is selected, include team_id and sold_amount
      if (playerTeamInput.value) {
        playerData.team_id = playerTeamInput.value;
        playerData.sold_amount = parseInt(playerSoldPriceInput.value) || playerData.base_price;
        playerData.status = PLAYER_STATUSES.SOLD;
      }

      // Check if there's an image file
      const imageInput = document.getElementById('player-image-upload');
      
      if (imageInput && imageInput.files && imageInput.files.length > 0) {
        // Create the player first to get an ID
        createPlayer(playerData, imageInput.files[0]);
      } else {
        // No image, just create player
        createPlayer(playerData);
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
      const playerName = e.target.closest('tr').querySelector('td:first-child').textContent;
      if (confirm(`Are you sure you want to delete player "${playerName}"?`)) {
        deletePlayer(playerId);
      }
    }
    
    // Edit player button
    else if (e.target.classList.contains('edit-player-btn')) {
      const btn = e.target.closest('.edit-player-btn');
      if (!btn) return;
      
      const playerId = btn.getAttribute('data-player-id');
      const playerName = btn.getAttribute('data-player-name');
      const playerRole = btn.getAttribute('data-player-role');
      const playerBasePrice = btn.getAttribute('data-player-base-price');
      const playerImageUrl = btn.getAttribute('data-player-image-url');
      const playerStatus = btn.getAttribute('data-player-status');
      const playerCountry = btn.getAttribute('data-player-country') || '';
      const playerStats = btn.getAttribute('data-player-stats') || '{}';
      
      // Populate edit form
      document.getElementById('edit-player-id').value = playerId;
      document.getElementById('edit-player-name').value = playerName;
      document.getElementById('edit-player-role').value = playerRole;
      document.getElementById('edit-player-base-price').value = playerBasePrice;
      document.getElementById('edit-player-status').value = playerStatus || PLAYER_STATUSES.AVAILABLE;
      
      // Set country and stats if those fields exist
      const countryField = document.getElementById('edit-player-country');
      if (countryField) countryField.value = playerCountry;
      
      const statsField = document.getElementById('edit-player-stats');
      if (statsField) statsField.value = playerStats;
      
      // Show image preview if it exists
      const preview = document.getElementById('edit-player-image-preview');
      const placeholder = document.getElementById('edit-player-image-placeholder');
      
      if (preview && placeholder) {
        if (playerImageUrl && playerImageUrl.trim() !== '') {
          preview.src = playerImageUrl;
          preview.classList.remove('d-none');
          placeholder.classList.add('d-none');
        } else {
          preview.classList.add('d-none');
          placeholder.classList.remove('d-none');
        }
        
        // Store the current image URL for later use
        preview.dataset.currentUrl = playerImageUrl || '';
      }
      
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
      fetchWithErrorHandling(API.PLAYER_BY_ID(playerId))
        .then(data => {
          if (data && data.player) {
            document.getElementById('assign-price').value = data.player.base_price;
          }
        });
      
      // Show modal
      assignPlayerModal.show();
    }
    
    // Reset player button
    else if (e.target.classList.contains('reset-player-btn')) {
      const playerId = e.target.getAttribute('data-player-id');
      const playerName = e.target.closest('tr').querySelector('td:first-child').textContent;
      if (confirm(`Are you sure you want to reset "${playerName}"'s auction status?`)) {
        resetPlayerAuction(playerId);
      }
    }
    
    // Start player auction button
    else if (e.target.classList.contains('start-player-auction-btn')) {
      const playerId = e.target.getAttribute('data-player-id');
      const playerName = e.target.getAttribute('data-player-name');
      
      if (confirm(`Start auction for "${playerName}"?`)) {
        startPlayerAuction(playerId);
      }
    }
  });
  
  // Edit player form submission
  const confirmEditBtn = document.getElementById('confirm-edit-btn');
  if (confirmEditBtn) {
    confirmEditBtn.addEventListener('click', function() {
      if (!validateForm('edit')) {
        return;
      }

      const playerId = document.getElementById('edit-player-id').value;
      const imageInput = document.getElementById('edit-player-image-upload');
      const currentImageUrl = document.getElementById('edit-player-image-preview').dataset.currentUrl;
      
      // Create form data object for player data
      const playerData = {
        name: document.getElementById('edit-player-name').value,
        role: document.getElementById('edit-player-role').value,
        base_price: parseInt(document.getElementById('edit-player-base-price').value),
        status: document.getElementById('edit-player-status').value,
        image_url: currentImageUrl // Use current image URL by default
      };
      
      // Add country if the field exists
      const countryField = document.getElementById('edit-player-country');
      if (countryField) playerData.country = countryField.value;
      
      // Try to parse stats JSON if provided
      try {
        const statsField = document.getElementById('edit-player-stats');
        if (statsField && statsField.value && statsField.value.trim() !== '') {
          playerData.stats = JSON.parse(statsField.value);
        }
      } catch (e) {
        console.error('Error parsing stats JSON:', e);
        return showAlert('Error in stats JSON format. Please check and try again.', 'danger');
      }
      
      // If there's a new image file, update the player first and then upload the image
      if (imageInput && imageInput.files && imageInput.files.length > 0) {
        // First update the player
        updatePlayer(playerId, playerData, imageInput.files[0]);
      } else {
        // No new image, just update the player
        updatePlayer(playerId, playerData);
      }
    });
  }
  
  // Edit modal image preview
  const editImageUpload = document.getElementById('edit-player-image-upload');
  if (editImageUpload) {
    editImageUpload.addEventListener('change', function(e) {
      const preview = document.getElementById('edit-player-image-preview');
      const placeholder = document.getElementById('edit-player-image-placeholder');
      
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          preview.src = e.target.result;
          preview.classList.remove('d-none');
          placeholder.classList.add('d-none');
        }
        reader.readAsDataURL(this.files[0]);
      } else {
        preview.classList.add('d-none');
        placeholder.classList.remove('d-none');
      }
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
      
      if (!price || isNaN(price) || price <= 0) {
        showAlert('Please enter a valid price', 'warning');
        return;
      }
      
      // Send request to assign player
      fetchWithErrorHandling(API.PLAYER_ASSIGN(playerId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          amount: price
        })
      })
      .then(data => {
        if (data) {
          // Hide modal
          assignPlayerModal.hide();
          
          // Refresh player list
          loadPlayers();
          
          // Show success message
          showAlert('Player assigned to team successfully!', 'success');
        }
      });
    });
  }
  
  // Helper function for form validation
  function validateForm(formType) {
    let nameField, roleField, priceField;
    
    if (formType === 'add') {
      nameField = playerNameInput;
      roleField = playerRoleInput;
      priceField = playerBasePriceInput;
    } else if (formType === 'edit') {
      nameField = document.getElementById('edit-player-name');
      roleField = document.getElementById('edit-player-role');
      priceField = document.getElementById('edit-player-base-price');
    } else {
      return true; // Unknown form type, skip validation
    }
    
    // Check name
    if (!nameField || !nameField.value.trim()) {
      showAlert('Player name is required', 'warning');
      nameField?.focus();
      return false;
    }
    
    // Check role
    if (!roleField || !roleField.value) {
      showAlert('Please select a player role', 'warning');
      roleField?.focus();
      return false;
    }
    
    // Check base price
    const basePrice = priceField ? parseInt(priceField.value) : 0;
    if (!basePrice || isNaN(basePrice) || basePrice <= 0) {
      showAlert('Please enter a valid base price', 'warning');
      priceField?.focus();
      return false;
    }
    
    return true;
  }
  
  // Helper function for API requests with consistent error handling
  function fetchWithErrorHandling(url, options = {}) {
    return fetch(url, options)
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.error || err.message || `API request failed with status ${response.status}`);
          });
        }
        return response.json();
      })
      .catch(error => {
        console.error(`Error in API request to ${url}:`, error);
        showAlert(`Error: ${error.message}`, 'danger');
        return null;
      });
  }
  
  // Load players function
  function loadPlayers() {
    fetchWithErrorHandling(API.PLAYERS + '/all')
      .then(data => {
        if (!data) return;
        
        // Update player count
        const playerCount = document.getElementById('player-count');
        if (playerCount) {
          playerCount.textContent = data.players.length;
        }
        
        // Update role counts in statistics
        updateRoleStats(data.players);
        
        // Clear table body
        playersTableBody.innerHTML = '';
        
        // If no players, show message
        if (!data.players || data.players.length === 0) {
          playersTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No players available</td></tr>`;
          return;
        }
        
        // Populate table with players
        data.players.forEach(player => {
          appendPlayerRow(player);
        });
        
        // Apply current filter
        filterPlayers();
      });
  }
  
  // Update role statistics
  function updateRoleStats(players) {
    if (!players) return;
    
    // Count players by role
    const roleCounts = {
      [PLAYER_ROLES.BATSMAN]: 0,
      [PLAYER_ROLES.BOWLER]: 0,
      [PLAYER_ROLES.ALL_ROUNDER]: 0,
      [PLAYER_ROLES.WICKET_KEEPER]: 0
    };
    
    players.forEach(player => {
      const role = normalizeRole(player.role);
      if (roleCounts[role] !== undefined) {
        roleCounts[role]++;
      }
    });
    
    // Update UI elements
    const batsmanCount = document.getElementById('stat-batsman-count');
    const bowlerCount = document.getElementById('stat-bowler-count');
    const allRounderCount = document.getElementById('stat-all-rounder-count');
    const wicketKeeperCount = document.getElementById('stat-wicket-keeper-count');
    
    if (batsmanCount) batsmanCount.textContent = roleCounts[PLAYER_ROLES.BATSMAN];
    if (bowlerCount) bowlerCount.textContent = roleCounts[PLAYER_ROLES.BOWLER];
    if (allRounderCount) allRounderCount.textContent = roleCounts[PLAYER_ROLES.ALL_ROUNDER];
    if (wicketKeeperCount) wicketKeeperCount.textContent = roleCounts[PLAYER_ROLES.WICKET_KEEPER];
  }
  
  // Normalize role to handle different casings
  function normalizeRole(role) {
    if (!role) return PLAYER_ROLES.BATSMAN;
    
    const lowerRole = role.toLowerCase();
    
    if (lowerRole.includes('batsman')) return PLAYER_ROLES.BATSMAN;
    if (lowerRole.includes('bowler')) return PLAYER_ROLES.BOWLER;
    if (lowerRole.includes('all') && lowerRole.includes('round')) return PLAYER_ROLES.ALL_ROUNDER;
    if (lowerRole.includes('wicket') && lowerRole.includes('keep')) return PLAYER_ROLES.WICKET_KEEPER;
    
    return role; // Return original if no match
  }
  
  // Helper function to append a player row to the table
  function appendPlayerRow(player) {
    const status = player.team_id ? PLAYER_STATUSES.SOLD : (player.status === PLAYER_STATUSES.UNSOLD ? PLAYER_STATUSES.UNSOLD : PLAYER_STATUSES.AVAILABLE);
    
    // Get normalized role and display config
    const normalizedRole = normalizeRole(player.role);
    const roleConfig = ROLE_DISPLAY_CONFIG[normalizedRole] || {
      displayName: player.role,
      roleClass: '',
      iconClass: '',
      icon: 'fas fa-user'
    };
    
    const row = document.createElement('tr');
    row.className = 'player-row';
    row.setAttribute('data-status', status);
    
    row.innerHTML = `
      <td>${player.name}</td>
      <td>
        <span class="${roleConfig.roleClass}">
          <span class="role-icon ${roleConfig.iconClass}">
            <i class="${roleConfig.icon}"></i>
          </span>
          ${roleConfig.displayName}
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
          data-player-country="${player.country || ''}"
          data-player-stats="${(player.stats && JSON.stringify(player.stats)) || '{}'}"
          data-player-status="${Array.isArray(player.status) ? player.status[0] : player.status || PLAYER_STATUSES.AVAILABLE}">
          <i class="fas fa-edit me-1"></i>Edit
        </button>
        <button class="btn btn-sm btn-danger delete-player-btn" data-player-id="${player.id}">Delete</button>
      </td>
    `;
    
    playersTableBody.appendChild(row);
  }
  
  // Filter players function
  function filterPlayers() {
    const searchTerm = playerSearchInput ? playerSearchInput.value.toLowerCase() : '';
    const filterValue = playerFilterSelect ? playerFilterSelect.value : 'all';
    
    const rows = document.querySelectorAll('.player-row');
    let visibleCount = 0;
    
    rows.forEach(row => {
      const playerName = row.cells[0].textContent.toLowerCase();
      const playerRole = row.cells[1].textContent.toLowerCase();
      const status = row.getAttribute('data-status');
      
      // Check if player name or role matches search term
      const matchesSearch = playerName.includes(searchTerm) || playerRole.includes(searchTerm);
      
      // Check if status matches filter
      const matchesFilter = filterValue === 'all' || status === filterValue;
      
      // Show/hide row based on matches
      if (matchesSearch && matchesFilter) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });
    
    // Update the visible count
    const playerCount = document.getElementById('player-count');
    if (playerCount) {
      playerCount.textContent = visibleCount;
    }
  }
  
  // Delete player function
  function deletePlayer(playerId) {
    fetchWithErrorHandling(API.PLAYER_BY_ID(playerId), {
      method: 'DELETE'
    })
    .then(data => {
      if (data) {
        loadPlayers();
        showAlert('Player deleted successfully!', 'success');
      }
    });
  }
  
  // Reset player auction function
  function resetPlayerAuction(playerId) {
    fetchWithErrorHandling(API.PLAYER_RESET(playerId), {
      method: 'POST'
    })
    .then(data => {
      if (data) {
        loadPlayers();
        showAlert('Player reset successfully!', 'success');
      }
    });
  }
  
  // Start player auction function
  function startPlayerAuction(playerId) {
    fetchWithErrorHandling(API.START_AUCTION(playerId), {
      method: 'POST'
    })
    .then(data => {
      if (data) {
        showAlert('Auction started for player!', 'success');
      }
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
      return fetchWithErrorHandling(API.PLAYERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(player)
      })
      .then(result => {
        if (result) {
          importedCount++;
        } else {
          errorCount++;
        }
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
    fetchWithErrorHandling(API.PLAYERS + '/all')
      .then(data => {
        if (!data || !data.players || data.players.length === 0) {
          showAlert('No players to export', 'warning');
          return;
        }
        
        // Create CSV header
        const headers = ['name', 'role', 'base_price', 'team_name', 'sold_amount', 'status', 'image_url', 'country'];
        let csvContent = headers.join(',') + '\n';
        
        // Add player data
        data.players.forEach(player => {
          const status = Array.isArray(player.status) ? player.status[0] : (player.status || PLAYER_STATUSES.AVAILABLE);
          
          const values = [
            `"${player.name || ''}"`,
            `"${player.role || ''}"`,
            player.base_price || 0,
            `"${player.team_name || ''}"`,
            player.sold_amount || 0,
            `"${status}"`,
            `"${player.image_url || ''}"`,
            `"${player.country || ''}"`
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
        
        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(url);
          document.body.removeChild(link);
        }, 100);
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
    if (!toastContainer) return; // No container to show alerts
    
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
    
    // Add event listener for close button
    const closeBtn = toast.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      });
    }
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 300);
      }
    }, 5000);
  }
  
  // Helper function to create a player
  function createPlayer(playerData, imageFile = null) {
    fetchWithErrorHandling(API.PLAYERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(playerData)
    })
    .then(data => {
      if (!data) return; // Error already handled
      
      // If we have an image file, upload it now that we have a player ID
      if (imageFile) {
        const formData = new FormData();
        formData.append('player_image', imageFile);
        
        return fetchWithErrorHandling(API.PLAYER_IMAGE(data.id), {
          method: 'POST',
          body: formData
        })
        .then(imageData => {
          resetAddPlayerForm();
          loadPlayers();
          
          if (imageData) {
            showAlert('Player created with image successfully!', 'success');
          } else {
            showAlert('Player created but image upload failed', 'warning');
          }
        });
      }
      
      // No image file, just reset and reload
      resetAddPlayerForm();
      loadPlayers();
      showAlert('Player added successfully!', 'success');
    });
  }
  
  // Reset the add player form
  function resetAddPlayerForm() {
    if (playerForm) playerForm.reset();
    if (playerSoldPriceContainer) playerSoldPriceContainer.style.display = 'none';
    
    // Reset image preview
    const preview = document.getElementById('player-image-preview');
    if (preview) {
      preview.innerHTML = '<span class="image-preview-placeholder">Image preview will appear here</span>';
    }
  }
  
  // Helper function to update player
  function updatePlayer(playerId, playerData, imageFile = null) {
    fetchWithErrorHandling(API.PLAYER_BY_ID(playerId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(playerData)
    })
    .then(data => {
      if (!data) return; // Error already handled
      
      // If we have an image file, upload it now
      if (imageFile) {
        const formData = new FormData();
        formData.append('player_image', imageFile);
        
        return fetchWithErrorHandling(API.PLAYER_IMAGE(playerId), {
          method: 'POST',
          body: formData
        })
        .then(imageData => {
          // Hide modal
          if (editPlayerModal) editPlayerModal.hide();
          
          // Refresh player list
          loadPlayers();
          
          if (imageData) {
            showAlert('Player updated with new image successfully!', 'success');
          } else {
            showAlert('Player updated but image upload failed', 'warning');
          }
        });
      }
      
      // No image file, just hide modal and reload
      if (editPlayerModal) editPlayerModal.hide();
      loadPlayers();
      showAlert('Player updated successfully!', 'success');
    });
  }
  
  // Initial load
  loadPlayers();
}); 