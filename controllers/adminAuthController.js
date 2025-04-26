const db = require('../utils/database');

// Admin credentials 
// In a production app, these would be stored securely in a database
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123'; // This would be hashed in a real app

// Show admin login page
exports.showLoginPage = async (req, res) => {
  try {
    res.render('admin_login', { 
      message: req.session.message || null
    });
    
    // Clear any flash message after displaying
    if (req.session.message) {
      delete req.session.message;
    }
  } catch (error) {
    console.error('Error showing admin login page:', error);
    res.status(500).send('Error loading admin login page: ' + error.message);
  }
};

// Process admin login
exports.processLogin = async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Validate credentials
    // In a real app, you'd validate against a database and use proper password hashing
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Login successful
      req.session.isAdmin = true;
      req.session.adminUsername = username;
      
      // Check if there's a return URL stored in the session and redirect there
      if (req.session.adminReturnTo) {
        const returnTo = req.session.adminReturnTo;
        delete req.session.adminReturnTo;
        return res.redirect(returnTo);
      }
      
      // Otherwise, redirect to the admin dashboard
      return res.redirect('/admin');
    } else {
      // Login failed
      req.session.message = {
        type: 'danger',
        text: 'Invalid username or password'
      };
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.error('Error processing admin login:', error);
    req.session.message = {
      type: 'danger',
      text: 'An error occurred during login'
    };
    return res.redirect('/admin/login');
  }
};

// Admin logout
exports.logout = (req, res) => {
  // Clear admin session data
  delete req.session.isAdmin;
  delete req.session.adminUsername;
  
  req.session.message = {
    type: 'success',
    text: 'You have been logged out successfully'
  };
  
  res.redirect('/admin/login');
};

// Middleware to check if user is authenticated as admin
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  
  // Store the original URL the user was trying to access
  req.session.adminReturnTo = req.originalUrl;
  
  req.session.message = {
    type: 'warning',
    text: 'Please login as administrator to access this page'
  };
  
  res.redirect('/admin/login');
}; 