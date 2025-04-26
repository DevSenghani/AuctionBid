const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// Home page
router.get('/', homeController.showHomePage);

module.exports = router; 