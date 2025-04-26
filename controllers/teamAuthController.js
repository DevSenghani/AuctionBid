const teamModel = require('../models/teamModel');
const db = require('../utils/database');

// Show team login page
exports.showLoginPage = async (req, res) => {
  try {
    console.log('Loading team login page...');
    
    let teams = [];
    
    try {
      teams = await teamModel.getAllTeams();
      console.log(`Retrieved ${teams.length} teams for login page`);
    } catch (error) {
      console.error('Error fetching teams for login page:', error);
      teams = []; // Set to empty array to prevent template issues
    }
    
    res.render('team_login', { 
      teams,
      message: req.session.message || null,
      usingMockDb: db.isMockDb()
    });
    
    // Clear any flash message after displaying
    if (req.session.message) {
      delete req.session.message;
    }
  } catch (error) {
    console.error('Error showing login page:', error);
    res.status(500).send('Error loading login page: ' + error.message);
  }
};

// Process team login
exports.processLogin = async (req, res) => {
  const { team_id, access_code } = req.body;
  
  try {
    if (!team_id || !access_code) {
      req.session.message = {
        type: 'danger',
        text: 'Please select a team and provide an access code'
      };
      return res.redirect('/team/login');
    }
    
    // Retrieve team info
    const team = await teamModel.getTeamById(team_id);
    
    if (!team) {
      req.session.message = {
        type: 'danger',
        text: 'Team not found'
      };
      return res.redirect('/team/login');
    }
    
    // Check if provided access code matches stored password
    if (team.password && access_code === team.password) {
      // Login successful
      req.session.teamId = team.id;
      req.session.teamName = team.name;
      req.session.isTeamLoggedIn = true;
      
      // Check if there's a return URL stored in the session and redirect there
      if (req.session.returnTo) {
        const returnTo = req.session.returnTo;
        delete req.session.returnTo;
        return res.redirect(returnTo);
      }
      
      // Otherwise, redirect to the team dashboard
      return res.redirect('/team/dashboard');
    } else {
      // Login failed
      req.session.message = {
        type: 'danger',
        text: 'Invalid access code'
      };
      return res.redirect('/team/login');
    }
  } catch (error) {
    console.error('Error processing team login:', error);
    req.session.message = {
      type: 'danger',
      text: 'An error occurred during login'
    };
    return res.redirect('/team/login');
  }
};

// Team logout
exports.logout = (req, res) => {
  // Clear team session data
  delete req.session.teamId;
  delete req.session.teamName;
  delete req.session.isTeamLoggedIn;
  
  req.session.message = {
    type: 'success',
    text: 'You have been logged out successfully'
  };
  
  res.redirect('/team/login');
};

// Check if team is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.session.isTeamLoggedIn) {
    return next();
  }
  
  req.session.message = {
    type: 'warning',
    text: 'Please login to access team dashboard'
  };
  
  res.redirect('/team/login');
}; 