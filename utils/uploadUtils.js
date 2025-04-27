const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure player image upload storage
const playerImageStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/players');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Get player ID from request params or body
    const playerId = req.params.id || req.body.player_id;
    
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    
    // Format: player-{ID}-{timestamp}-{random}.{ext}
    const filename = `player-${playerId}-${uniqueSuffix}${ext}`;
    
    cb(null, filename);
  }
});

// File filter for image uploads
const imageFileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create multer upload instance for player images
const uploadPlayerImage = multer({ 
  storage: playerImageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

module.exports = {
  uploadPlayerImage
}; 