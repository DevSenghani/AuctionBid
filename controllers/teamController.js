const teamModel = require('../models/teamModel');
const playerModel = require('../models/playerModel');
const db = require('../utils/database');

// Show teams page with all teams
exports.showTeamsPage = async (req, res) => {
  try {
    console.log('Loading teams page...');
    
    let teams = [];
    
    try {
      teams = await teamModel.getAllTeams();
      console.log(`Retrieved ${teams.length} teams`);
    } catch (error) {
      console.error('Error fetching teams:', error);
      teams = []; // Set to empty array to prevent template issues
    }
    
    res.render('teams', { 
      title: 'Teams',
      teams,
      usingMockDb: db.isMockDb()
    });
  } catch (error) {
    console.error('Error loading teams page:', error);
    res.status(500).send('Error loading teams page: ' + error.message);
  }
};

// Get a specific team with their players
exports.getTeamDetails = async (req, res) => {
  try {
    const teamId = req.params.id;
    
    let team = null;
    let players = [];
    
    try {
      team = await teamModel.getTeamById(teamId);
    } catch (error) {
      console.error('Error fetching team details:', error);
    }
    
    if (!team) {
      // If we're using mock data, create a mock team
      if (db.isMockDb()) {
        team = { 
          id: teamId, 
          name: 'Mock Team ' + teamId,
          owner: 'Mock Owner',
          budget: 1000000
        };
      } else {
        return res.status(404).json({ error: 'Team not found' });
      }
    }
    
    // Get players belonging to this team
    try {
      const playersResult = await db.query(
        'SELECT * FROM players WHERE team_id = $1',
        [teamId]
      );
      players = playersResult.rows;
    } catch (error) {
      console.error('Error fetching team players:', error);
      players = []; // Set to empty array to prevent issues
    }
    
    res.json({
      team,
      players,
      usingMockDb: db.isMockDb()
    });
  } catch (error) {
    console.error('Error getting team details:', error);
    res.status(500).json({ error: 'Failed to load team details: ' + error.message });
  }
};

// Update team information
exports.updateTeam = async (req, res) => {
  try {
    const teamId = req.params.id;
    const { name, owner, budget } = req.body;
    
    let updatedTeam = null;
    
    try {
      const result = await db.query(
        'UPDATE teams SET name = $1, owner = $2, budget = $3 WHERE id = $4 RETURNING *',
        [name, owner, budget, teamId]
      );
      
      if (result.rows.length > 0) {
        updatedTeam = result.rows[0];
      }
    } catch (error) {
      console.error('Error updating team in database:', error);
    }
    
    if (!updatedTeam) {
      if (db.isMockDb()) {
        // Return mock data for demo purposes
        updatedTeam = { 
          id: teamId, 
          name, 
          owner, 
          budget 
        };
      } else {
        return res.status(404).json({ error: 'Team not found' });
      }
    }
    
    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team: ' + error.message });
  }
}; 