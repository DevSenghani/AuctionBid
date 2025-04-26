/**
 * Authentication Middleware
 * 
 * Provides functions to check if users are authenticated
 * before accessing protected routes.
 */

// Middleware to check if a team is logged in
exports.isTeamAuthenticated = (req, res, next) => {
  if (req.session && req.session.isTeamLoggedIn) {
    // Team is authenticated, proceed to the next middleware
    return next();
  }
  
  // Store the original URL the user was trying to access
  req.session.returnTo = req.originalUrl;
  
  // Set a message to inform the user they need to log in
  req.session.message = {
    type: 'warning',
    text: 'Please log in to access the auction page'
  };
  
  // Redirect to the team login page
  res.redirect('/team/login');
};

// Middleware to check if the user is an admin (for future use)
exports.isAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  
  req.session.message = {
    type: 'danger',
    text: 'You must be an administrator to access this page'
  };
  
  res.redirect('/home');
}; 