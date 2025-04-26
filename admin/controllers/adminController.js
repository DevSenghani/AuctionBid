const Player = require('../../server/models/Player');
const Team = require('../../server/models/Team');

// Admin adds a player to the auction
exports.addPlayer = async (req, res) => {
  try {
    const { name, role, basePrice } = req.body;
    const player = await Player.save({ name, role, basePrice });
    res.status(201).json({ message: 'Player added successfully', player });
  } catch (error) {
    res.status(500).json({ message: 'Error adding player', error });
  }
};

// Admin adds a team to the auction
exports.addTeam = async (req, res) => {
  try {
    const { name, owner, logoUrl } = req.body;
    const team = await Team.save({ name, owner, logoUrl });
    res.status(201).json({ message: 'Team added successfully', team });
  } catch (error) {
    res.status(500).json({ message: 'Error adding team', error });
  }
};
