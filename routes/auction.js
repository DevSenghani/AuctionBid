const express = require('express');
const router = express.Router();
const db = require('../database');

// Get auction status
router.get('/status', (req, res) => {
    try {
        const status = db.getAuctionStatus();
        if (status.current_player_id) {
            const player = db.getPlayerById(status.current_player_id);
            if (player) {
                status.current_player_name = player.name;
                status.current_player_role = player.role;
                status.current_player_base_price = player.base_price;
                status.currentPlayer = player;
            }
        }
        
        // Check if server provides timeRemaining or calculate from timestamp
        if (!status.timeRemaining && status.current_player_timestamp) {
            const now = new Date();
            const playerStartTime = new Date(status.current_player_timestamp);
            const elapsedSeconds = Math.floor((now - playerStartTime) / 1000);
            const DEFAULT_PLAYER_AUCTION_TIME = 60; // same as server constant
            status.timeRemaining = Math.max(0, DEFAULT_PLAYER_AUCTION_TIME - elapsedSeconds);
        }
        
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start auction for a player
router.post('/start', (req, res) => {
    try {
        const { player_id } = req.body;
        if (!player_id) {
            return res.status(400).json({ success: false, message: 'Player ID is required' });
        }
        
        const player = db.getPlayerById(player_id);
        if (!player) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }
        
        db.startAuction(player_id);
        res.json({ success: true, message: 'Auction started successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Pause auction
router.post('/pause', (req, res) => {
    try {
        db.pauseAuction();
        res.json({ success: true, message: 'Auction paused successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// End auction
router.post('/end', (req, res) => {
    try {
        db.endAuction();
        res.json({ success: true, message: 'Auction ended successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get bids for a player
router.get('/bids/:player_id', (req, res) => {
    try {
        const { player_id } = req.params;
        const bids = db.getBidsByPlayerId(player_id);
        res.json({ bids });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Finalize sale (mark player as sold)
router.post('/finalize-sale', (req, res) => {
    try {
        const status = db.getAuctionStatus();
        if (!status.current_player_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'No active auction to finalize' 
            });
        }
        
        const bids = db.getBidsByPlayerId(status.current_player_id);
        if (!bids || bids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No bids placed for this player' 
            });
        }
        
        // Find highest bid
        const highestBid = bids.reduce((prev, current) => {
            return (prev.amount > current.amount) ? prev : current;
        });
        
        db.finalizeSale(status.current_player_id, highestBid.team_id, highestBid.amount);
        db.endAuction();
        
        res.json({ 
            success: true, 
            message: 'Sale finalized successfully',
            team_id: highestBid.team_id,
            amount: highestBid.amount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark player as unsold
router.post('/mark-unsold', (req, res) => {
    try {
        const status = db.getAuctionStatus();
        if (!status.current_player_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'No active auction to mark as unsold' 
            });
        }
        
        db.markPlayerUnsold(status.current_player_id);
        db.endAuction();
        
        res.json({ 
            success: true, 
            message: 'Player marked as unsold successfully' 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get recent sales
router.get('/recent-sales', (req, res) => {
    try {
        const sales = db.getRecentSales();
        res.json({ sales });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 