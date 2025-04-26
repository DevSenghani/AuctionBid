const Player = require('../models/Player');
const Team = require('../models/Team');
const Bid = require('../models/Bid');

// Add a player to the auction
exports.addPlayer = async (req, res) => {
  try {
    const { name, role, basePrice } = req.body;
    const player = new Player({ name, role, basePrice });
    await player.save();
    res.status(201).send({ message: 'Player added successfully', player });
  } catch (error) {
    res.status(500).send({ message: 'Error adding player', error });
  }
};

// Add a team to the auction
exports.addTeam = async (req, res) => {
  try {
    const { name, owner, logoUrl } = req.body;
    const team = new Team({ name, owner, logoUrl });
    await team.save();
    res.status(201).send({ message: 'Team added successfully', team });
  } catch (error) {
    res.status(500).send({ message: 'Error adding team', error });
  }
};

// Get all players in the auction
exports.getPlayers = async (req, res) => {
  try {
    const players = await Player.find();
    res.status(200).send(players);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching players', error });
  }
};

// Get all teams
exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find();
    res.status(200).send(teams);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching teams', error });
  }
};

// Get auction results (players with the winning bids)
exports.getAuctionResults = async (req, res) => {
  try {
    const results = await Bid.find()
      .populate('player')
      .populate('team')
      .exec();
    res.status(200).send(results);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching auction results', error });
  }
};
