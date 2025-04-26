const teamModel = require('../models/teamModel');
const playerModel = require('../models/playerModel');
const db = require('../utils/database');

// Show results page with teams and their acquired players
exports.showResultsPage = async (req, res) => {
  try {
    // Get all teams with their remaining budget
    const teams = await teamModel.getAllTeams();
    
    // For each team, get their players with auction amounts
    const teamsWithPlayers = await Promise.all(teams.map(async (team) => {
      // Get all players for this team
      const players = await db.query(`
        SELECT p.*, b.amount as bid_amount
        FROM players p
        LEFT JOIN bids b ON (
          b.player_id = p.id AND 
          b.amount = (SELECT MAX(amount) FROM bids WHERE player_id = p.id)
        )
        WHERE p.team_id = $1
      `, [team.id]);
      
      return {
        ...team,
        players: players.rows
      };
    }));
    
    res.render('results', {
      title: 'Auction Results',
      teams: teamsWithPlayers
    });
  } catch (error) {
    console.error('Error loading results page:', error);
    res.status(500).send('Error loading results page');
  }
};

// Get statistical summary of the auction
exports.getAuctionStats = async (req, res) => {
  try {
    // Most expensive players
    const expensivePlayers = await db.query(`
      SELECT p.*, t.name as team_name, b.amount
      FROM players p
      JOIN teams t ON p.team_id = t.id
      JOIN bids b ON (
        b.player_id = p.id AND
        b.amount = (SELECT MAX(amount) FROM bids WHERE player_id = p.id)
      )
      WHERE p.team_id IS NOT NULL
      ORDER BY b.amount DESC
      LIMIT 5
    `);
    
    // Teams with most players by role
    const roleDistribution = await db.query(`
      SELECT t.name as team_name, p.role, COUNT(*) as count
      FROM players p
      JOIN teams t ON p.team_id = t.id
      WHERE p.team_id IS NOT NULL
      GROUP BY t.name, p.role
      ORDER BY t.name, count DESC
    `);
    
    // Team spending summary
    const teamSpending = await db.query(`
      SELECT t.id, t.name, t.budget as remaining_budget,
        1000000 - t.budget as spent_budget,
        COUNT(p.id) as total_players
      FROM teams t
      LEFT JOIN players p ON p.team_id = t.id
      GROUP BY t.id, t.name, t.budget
      ORDER BY spent_budget DESC
    `);
    
    res.json({
      expensivePlayers: expensivePlayers.rows,
      roleDistribution: roleDistribution.rows,
      teamSpending: teamSpending.rows
    });
  } catch (error) {
    console.error('Error getting auction stats:', error);
    res.status(500).json({ error: 'Failed to load auction statistics' });
  }
}; 