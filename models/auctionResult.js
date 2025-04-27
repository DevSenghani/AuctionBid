const fs = require('fs');
const path = require('path');

/**
 * Class representing an auction result
 */
class AuctionResult {
  /**
   * Create a new auction result
   * @param {Object} data - Auction result data
   * @param {Date} data.endTime - Time when the auction ended
   * @param {String} data.endedBy - Username of admin who ended the auction
   * @param {Array} data.soldPlayers - Array of players sold in the auction
   * @param {Number} data.totalAmount - Total amount spent in the auction
   */
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.endTime = data.endTime || new Date().toISOString();
    this.endedBy = data.endedBy || 'system';
    this.soldPlayers = data.soldPlayers || [];
    this.unsoldPlayers = data.unsoldPlayers || [];
    this.totalAmount = data.totalAmount || 0;
    this.totalPlayers = data.totalPlayers || 0;
    this.teamsParticipated = data.teamsParticipated || [];
    this.reason = data.reason || 'Auction completed';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Save the auction result to the database
   * @returns {Promise<Object>} - Saved auction result
   */
  async save() {
    try {
      const resultsDir = path.join(__dirname, '../data/auction_results');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      const filePath = path.join(resultsDir, `${this.id}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(this, null, 2));
      
      // Update the index file with all results
      const results = await AuctionResult.getAllResults();
      const exists = results.find(result => result.id === this.id);
      
      if (!exists) {
        results.push(this);
      } else {
        // Update existing result
        const index = results.findIndex(result => result.id === this.id);
        if (index !== -1) {
          results[index] = this;
        }
      }
      
      const indexPath = path.join(resultsDir, 'index.json');
      await fs.promises.writeFile(indexPath, JSON.stringify(results, null, 2));
      
      return this;
    } catch (error) {
      console.error('Error saving auction result:', error);
      throw error;
    }
  }

  /**
   * Retrieve all auction results
   * @returns {Promise<Array>} - Array of auction results
   */
  static async getAllResults() {
    try {
      const resultsDir = path.join(__dirname, '../data/auction_results');
      const indexPath = path.join(resultsDir, 'index.json');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      // Create index file if it doesn't exist
      if (!fs.existsSync(indexPath)) {
        await fs.promises.writeFile(indexPath, JSON.stringify([], null, 2));
        return [];
      }
      
      const data = await fs.promises.readFile(indexPath, 'utf8');
      const results = JSON.parse(data);
      
      // Convert plain objects to AuctionResult instances
      return results.map(result => new AuctionResult(result));
    } catch (error) {
      console.error('Error getting auction results:', error);
      return [];
    }
  }

  /**
   * Calculate auction statistics
   * @returns {Object} - Auction statistics
   */
  calculateStatistics() {
    // Group players by team
    const teamStats = {};
    let highestBid = { amount: 0, player: null };
    let teamWithMostPlayers = { count: 0, team: null };

    this.soldPlayers.forEach(player => {
      // Track team statistics
      if (!teamStats[player.teamId]) {
        teamStats[player.teamId] = {
          teamName: player.teamName,
          playerCount: 0,
          totalSpent: 0,
          players: []
        };
      }
      
      const team = teamStats[player.teamId];
      team.playerCount++;
      team.totalSpent += player.soldAmount;
      team.players.push({
        name: player.name,
        role: player.role,
        amount: player.soldAmount
      });
      
      // Track highest bid
      if (player.soldAmount > highestBid.amount) {
        highestBid = {
          amount: player.soldAmount,
          player: player.name,
          team: player.teamName
        };
      }
      
      // Update team with most players
      if (team.playerCount > teamWithMostPlayers.count) {
        teamWithMostPlayers = {
          count: team.playerCount,
          team: player.teamName
        };
      }
    });

    // Calculate teams by spending brackets
    const spendingBrackets = {
      high: { min: 1000000, teams: [] },
      medium: { min: 500000, max: 999999, teams: [] },
      low: { max: 499999, teams: [] }
    };

    Object.values(teamStats).forEach(team => {
      if (team.totalSpent >= spendingBrackets.high.min) {
        spendingBrackets.high.teams.push({ name: team.teamName, spent: team.totalSpent });
      } else if (team.totalSpent >= spendingBrackets.medium.min) {
        spendingBrackets.medium.teams.push({ name: team.teamName, spent: team.totalSpent });
      } else {
        spendingBrackets.low.teams.push({ name: team.teamName, spent: team.totalSpent });
      }
    });

    return {
      teamStats,
      highestBid,
      teamWithMostPlayers,
      spendingBrackets,
      playersByRole: this.getPlayersByRole(),
      totalSold: this.soldPlayers.length,
      totalUnsold: this.unsoldPlayers.length,
      totalAmount: this.totalAmount
    };
  }

  getPlayersByRole() {
    const roleStats = {};
    
    this.soldPlayers.forEach(player => {
      if (!roleStats[player.role]) {
        roleStats[player.role] = {
          count: 0,
          totalAmount: 0,
          players: []
        };
      }
      
      roleStats[player.role].count++;
      roleStats[player.role].totalAmount += player.soldAmount;
      roleStats[player.role].players.push({
        name: player.name,
        team: player.teamName,
        amount: player.soldAmount
      });
    });
    
    return roleStats;
  }

  static async getResultById(id) {
    try {
      const resultsDir = path.join(__dirname, '../data/auction_results');
      const filePath = path.join(resultsDir, `${id}.json`);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const data = await fs.promises.readFile(filePath, 'utf8');
      const result = JSON.parse(data);
      
      return new AuctionResult(result);
    } catch (error) {
      console.error(`Error getting auction result with id ${id}:`, error);
      return null;
    }
  }

  static async deleteResult(id) {
    try {
      const resultsDir = path.join(__dirname, '../data/auction_results');
      const filePath = path.join(resultsDir, `${id}.json`);
      
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      
      // Update the index file
      const results = await AuctionResult.getAllResults();
      const updatedResults = results.filter(result => result.id !== id);
      
      const indexPath = path.join(resultsDir, 'index.json');
      await fs.promises.writeFile(indexPath, JSON.stringify(updatedResults, null, 2));
      
      return true;
    } catch (error) {
      console.error(`Error deleting auction result with id ${id}:`, error);
      return false;
    }
  }
}

module.exports = AuctionResult; 