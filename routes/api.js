const express = require('express');
const router = express.Router();
const db = require('../database');

// Get auction status
router.get('/auction/status', (req, res) => {
    try {
        // Check current auction status from database
        const status = db.getAuctionStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting auction status:', error);
        res.status(500).json({ error: 'Failed to get auction status' });
    }
});

// Get player details
router.get('/players/:id', (req, res) => {
    try {
        const playerId = req.params.id;
        const player = db.getPlayerById(playerId);
        
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        res.json(player);
    } catch (error) {
        console.error('Error getting player details:', error);
        res.status(500).json({ error: 'Failed to get player details' });
    }
});

// Get bids for a player
router.get('/auction/bids/:playerId', (req, res) => {
    try {
        const playerId = req.params.playerId;
        const bids = db.getBidsByPlayerId(playerId);
        res.json(bids);
    } catch (error) {
        console.error('Error getting bids:', error);
        res.status(500).json({ error: 'Failed to get bids' });
    }
});

// Get recently sold players
router.get('/auction/recent-sales', (req, res) => {
    try {
        const recentSales = db.getRecentSales();
        res.json(recentSales);
    } catch (error) {
        console.error('Error getting recent sales:', error);
        res.status(500).json({ error: 'Failed to get recent sales' });
    }
});

// Place a bid
router.post('/auction/bid', (req, res) => {
    try {
        const { player_id, team_id, amount } = req.body;
        
        // Validate required fields
        if (!player_id || !team_id || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Check if auction is running
        const auctionStatus = db.getAuctionStatus();
        if (auctionStatus.status !== 'running' || auctionStatus.currentPlayerId !== player_id) {
            return res.status(400).json({ error: 'Auction not running for this player' });
        }
        
        // Get team details to check budget
        const team = db.getTeamById(team_id);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        // Check if team has enough budget
        if (team.budget < amount) {
            return res.status(400).json({ error: 'Insufficient budget' });
        }
        
        // Get current highest bid
        const bids = db.getBidsByPlayerId(player_id);
        const currentHighestBid = bids.length > 0 ? bids[0].amount : 0;
        
        // Check if bid is higher than current highest bid
        if (amount <= currentHighestBid) {
            return res.status(400).json({ error: 'Bid must be higher than current bid' });
        }
        
        // Place the bid
        const newBid = db.placeBid(player_id, team_id, amount);
        
        // Return success response
        res.json({ 
            success: true, 
            message: 'Bid placed successfully',
            bid: newBid
        });
    } catch (error) {
        console.error('Error placing bid:', error);
        res.status(500).json({ error: 'Failed to place bid' });
    }
});

// Start auction
router.post('/auction/start', (req, res) => {
    try {
        const { player_id } = req.body;
        
        // Check if player_id is provided
        if (!player_id) {
            return res.status(400).json({ error: 'Player ID is required' });
        }
        
        // Get player details
        const player = db.getPlayerById(player_id);
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        // Start auction for player
        const result = db.startAuction(player_id);
        
        res.json({ 
            success: true, 
            message: 'Auction started',
            status: result
        });
    } catch (error) {
        console.error('Error starting auction:', error);
        res.status(500).json({ error: 'Failed to start auction' });
    }
});

// Pause auction
router.post('/auction/pause', (req, res) => {
    try {
        const result = db.pauseAuction();
        
        res.json({ 
            success: true, 
            message: 'Auction paused',
            status: result
        });
    } catch (error) {
        console.error('Error pausing auction:', error);
        res.status(500).json({ error: 'Failed to pause auction' });
    }
});

// End auction
router.post('/auction/end', (req, res) => {
    try {
        const result = db.endAuction();
        
        res.json({ 
            success: true, 
            message: 'Auction ended',
            status: result
        });
    } catch (error) {
        console.error('Error ending auction:', error);
        res.status(500).json({ error: 'Failed to end auction' });
    }
});

// Sell current player
router.post('/auction/finalize-sale', (req, res) => {
    try {
        // Get current auction status
        const auctionStatus = db.getAuctionStatus();
        if (auctionStatus.status !== 'running') {
            return res.status(400).json({ error: 'No active auction' });
        }
        
        const playerId = auctionStatus.currentPlayerId;
        
        // Get highest bid for the player
        const bids = db.getBidsByPlayerId(playerId);
        if (bids.length === 0) {
            return res.status(400).json({ error: 'No bids for this player' });
        }
        
        const highestBid = bids[0];
        
        // Finalize the sale
        const result = db.finalizeSale(playerId, highestBid.team_id, highestBid.amount);
        
        res.json({ 
            success: true, 
            message: 'Player sold successfully',
            sale: result
        });
    } catch (error) {
        console.error('Error finalizing sale:', error);
        res.status(500).json({ error: 'Failed to finalize sale' });
    }
});

// Unsold current player
router.post('/auction/mark-unsold', (req, res) => {
    try {
        // Get current auction status
        const auctionStatus = db.getAuctionStatus();
        if (auctionStatus.status !== 'running') {
            return res.status(400).json({ error: 'No active auction' });
        }
        
        const playerId = auctionStatus.currentPlayerId;
        
        // Mark player as unsold
        const result = db.markPlayerUnsold(playerId);
        
        res.json({ 
            success: true, 
            message: 'Player marked as unsold',
            result: result
        });
    } catch (error) {
        console.error('Error marking player as unsold:', error);
        res.status(500).json({ error: 'Failed to mark player as unsold' });
    }
});

module.exports = router; 