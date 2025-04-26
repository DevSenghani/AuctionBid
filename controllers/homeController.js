const teamModel = require('../models/teamModel');
const db = require('../utils/database');

// Show home page
exports.showHomePage = async (req, res) => {
  try {
    console.log('Loading home page...');
    
    let teams = [];
    
    try {
      teams = await teamModel.getAllTeams();
      console.log(`Retrieved ${teams.length} teams for home page`);
    } catch (error) {
      console.error('Error fetching teams for home page:', error);
      teams = []; // Set to empty array to prevent template issues
    }
    
    res.render('home', { 
      teams,
      message: req.session.message || null,
      usingMockDb: db.isMockDb()
    });
    
    // Clear any flash message after displaying
    if (req.session.message) {
      delete req.session.message;
    }
  } catch (error) {
    console.error('Error showing home page:', error);
    res.status(500).send('Error loading home page: ' + error.message);
  }
}; 