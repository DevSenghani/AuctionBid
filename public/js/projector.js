document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const elements = {
        playerName: document.getElementById('player-name'),
        playerImage: document.getElementById('player-image'),
        roleBadge: document.getElementById('role-badge'),
        basePrice: document.getElementById('base-price'),
        bidTimer: document.getElementById('bid-timer'),
        timeProgress: document.getElementById('time-progress'),
        currentBid: document.getElementById('current-bid'),
        currentBidder: document.getElementById('current-bidder'),
        upcomingPlayersList: document.getElementById('upcoming-players-list'),
        bidHistoryList: document.getElementById('bid-history-list'),
        playerCountry: document.getElementById('player-country'),
        playerStats: document.getElementById('player-stats')
    };
    
    // Constants
    const ROLE_CLASSES = {
        'Batsman': 'batsman',
        'Bowler': 'bowler',
        'All-Rounder': 'all-rounder',
        'All-rounder': 'all-rounder',
        'Wicket-Keeper': 'wicket-keeper',
        'Wicket-keeper': 'wicket-keeper'
    };
    
    const ROLE_BADGE_CLASSES = {
        'Batsman': 'bg-danger',
        'Bowler': 'bg-success',
        'All-Rounder': 'bg-warning',
        'All-rounder': 'bg-warning',
        'Wicket-Keeper': 'bg-info',
        'Wicket-keeper': 'bg-info'
    };
    
    // Initialize Socket.IO
    const socket = io();
    
    // Socket event handlers
    socket.on('connect', () => {
        console.log('Connected to server: ' + socket.id);
    });
    
    socket.on('auction-status', handleAuctionStatus);
    socket.on('new-bid', handleNewBid);
    socket.on('upcoming-players', handleUpcomingPlayers);
    socket.on('timer-update', handleTimerUpdate);
    
    // Event handler functions
    function handleAuctionStatus(data) {
        try {
            console.log('Received auction status:', data);
            const { currentPlayer, timeRemaining } = data;
            
            if (currentPlayer) {
                updateCurrentPlayer(currentPlayer);
            }
            
            if (timeRemaining !== undefined) {
                updateTimer(timeRemaining);
            }
        } catch (error) {
            console.error('Error handling auction status:', error);
        }
    }
    
    function handleNewBid(data) {
        console.log('Received new bid:', data);
        updateBidInfo(data);
    }
    
    function handleUpcomingPlayers(data) {
        console.log('Received upcoming players:', data);
        updateUpcomingPlayers(data.players);
    }
    
    function handleTimerUpdate(data) {
        console.log('Received timer update:', data);
        updateTimer(data.timeRemaining);
    }
    
    // UI update functions
    function updateCurrentPlayer(player) {
        elements.playerName.textContent = player.name;
        
        // Update role badge
        elements.roleBadge.textContent = player.role;
        elements.roleBadge.className = 'role-badge';
        const roleClass = ROLE_CLASSES[player.role];
        if (roleClass) {
            elements.roleBadge.classList.add(roleClass);
        }
        
        // Update base price
        elements.basePrice.textContent = formatCurrency(player.base_price || player.basePrice);
        
        // Update player image
        elements.playerImage.src = player.image_url || DEFAULT_IMAGES[player.role] || '/images/default-player.png';
        
        // Update player country
        elements.playerCountry.textContent = player.country || 'Unknown';
        
        // Format stats based on role
        let statsText = '';
        if (player.role === 'Batsman') {
            statsText = `Avg: ${player.batting_average || 'N/A'} | SR: ${player.strike_rate || 'N/A'}`;
        } else if (player.role === 'Bowler') {
            statsText = `Wickets: ${player.wickets || 'N/A'} | Econ: ${player.economy || 'N/A'}`;
        } else {
            statsText = `Bat Avg: ${player.batting_average || 'N/A'} | Wickets: ${player.wickets || 'N/A'}`;
        }
        elements.playerStats.textContent = statsText;
        
        // Reset bid info
        elements.currentBid.textContent = 'No bids yet';
        elements.currentBidder.textContent = '-';
        
        // Clear bid history
        elements.bidHistoryList.innerHTML = '<div class="text-center py-4"><p>No bids placed yet</p></div>';
        
        // Load bid history if player has an ID
        if (player.id) {
            loadBidHistory(player.id);
        }
    }
    
    function updateBidInfo(bid) {
        elements.currentBid.textContent = formatCurrency(bid.amount);
        elements.currentBidder.textContent = bid.team_name || bid.teamName;
        
        // Update bid history
        loadBidHistory(bid.player_id || bid.playerId);
    }
    
    function loadBidHistory(playerId) {
        fetch(`/auction/player/${playerId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.bids && data.bids.length > 0) {
                    renderBidHistory(data.bids);
                } else {
                    elements.bidHistoryList.innerHTML = '<div class="text-center py-4"><p>No bids placed yet</p></div>';
                }
            })
            .catch(error => {
                console.error('Error loading bid history:', error);
                elements.bidHistoryList.innerHTML = '<div class="text-center text-danger py-4"><p>Error loading bid history</p></div>';
            });
    }
    
    function renderBidHistory(bids) {
        elements.bidHistoryList.innerHTML = '';
        
        bids.forEach((bid, index) => {
            const bidItem = document.createElement('div');
            bidItem.className = index === 0 ? 'bid-item highest-bid' : 'bid-item';
            
            bidItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${bid.team_name}</strong>
                    </div>
                    <div class="bid-amount">₹${formatCurrency(bid.amount)}</div>
                </div>
                <div class="text-muted small mt-1"><i class="far fa-clock me-1"></i>${formatTime(bid.created_at || new Date())}</div>
            `;
            
            elements.bidHistoryList.appendChild(bidItem);
        });
    }
    
    function updateUpcomingPlayers(players) {
        if (!players || players.length === 0) {
            elements.upcomingPlayersList.innerHTML = '<div class="text-center py-4"><p>No upcoming players</p></div>';
            return;
        }
        
        elements.upcomingPlayersList.innerHTML = '';
        
        players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-list-item';
            
            playerItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${player.name}</strong>
                        <div class="mt-1">
                            <span class="badge ${ROLE_BADGE_CLASSES[player.role] || 'bg-secondary'}">${player.role}</span>
                            ${player.country ? `<span class="badge bg-secondary ms-1">${player.country}</span>` : ''}
                        </div>
                    </div>
                    <div>
                        <span class="badge bg-primary">₹${formatCurrency(player.base_price || player.basePrice)}</span>
                    </div>
                </div>
            `;
            
            elements.upcomingPlayersList.appendChild(playerItem);
        });
    }
    
    function updateTimer(timeRemaining) {
        if (!timeRemaining || timeRemaining <= 0) {
            elements.bidTimer.textContent = "--";
            elements.timeProgress.style.width = '0%';
            elements.timeProgress.className = 'progress-bar progress-bar-striped progress-bar-animated bg-secondary';
            return;
        }
        
        // Update timer text
        elements.bidTimer.textContent = timeRemaining;
        
        // Update progress bar
        const progressPercent = (timeRemaining / 60) * 100;
        elements.timeProgress.style.width = `${progressPercent}%`;
        
        // Update progress bar color based on time remaining
        if (progressPercent > 60) {
            elements.timeProgress.className = 'progress-bar progress-bar-striped progress-bar-animated bg-success';
        } else if (progressPercent > 30) {
            elements.timeProgress.className = 'progress-bar progress-bar-striped progress-bar-animated bg-warning';
        } else {
            elements.timeProgress.className = 'progress-bar progress-bar-striped progress-bar-animated bg-danger';
        }
        
        // Add warning class when time is running out
        if (timeRemaining <= 10) {
            elements.bidTimer.classList.add('warning');
        } else {
            elements.bidTimer.classList.remove('warning');
        }
    }
    
    // Helper functions
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN').format(amount);
    }
    
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    // Initial data loading
    function loadInitialData() {
        Promise.all([
            fetch('/auction/status').then(response => response.json()),
            fetch('/auction/upcoming-players').then(response => response.json())
        ])
        .then(([statusData, upcomingData]) => {
            console.log('Initial auction status:', statusData);
            console.log('Initial upcoming players:', upcomingData);
            
            if (statusData.currentPlayer) {
                updateCurrentPlayer(statusData.currentPlayer);
            }
            
            if (statusData.timeRemaining !== undefined) {
                updateTimer(statusData.timeRemaining);
            }
            
            if (upcomingData.players) {
                updateUpcomingPlayers(upcomingData.players);
            }
        })
        .catch(error => {
            console.error('Error loading initial data:', error);
            elements.upcomingPlayersList.innerHTML = '<div class="text-center text-danger py-4"><p>Error loading data</p></div>';
        });
    }
    
    // Initialize the application
    loadInitialData();
});