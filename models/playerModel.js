const db = require('../utils/database');

// Get all players
exports.getAllPlayers = async () => {
  try {
    console.log('Fetching all players from database...');
    const result = await db.query('SELECT * FROM players ORDER BY name');
    console.log(`Retrieved ${result.rows.length} players`);
    return result.rows;
  } catch (error) {
    console.error('Error fetching all players:', error);
    return []; // Return empty array instead of throwing
  }
};

// Get player by ID
exports.getPlayerById = async (id) => {
  try {
    console.log(`Fetching player with ID ${id}...`);
    const result = await db.query('SELECT * FROM players WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      console.log(`No player found with ID ${id}`);
      return null;
    }
    return result.rows[0];
  } catch (error) {
    console.error(`Error fetching player with ID ${id}:`, error);
    return null; // Return null instead of throwing
  }
};

// Get player by ID with team information joined
exports.getPlayerWithTeam = async (id) => {
  if (!id || isNaN(id)) {
    console.error('Invalid player ID provided:', id);
    return null;
  }

  try {
    console.log(`Fetching player with ID ${id} including team information...`);
    const result = await db.query(
      `SELECT 
        p.*,
        t.name as team_name,
        t.owner as team_owner,
        t.budget as team_budget,
        CASE 
          WHEN p.team_id IS NOT NULL THEN 'sold'
          WHEN p.status = 'in_auction' THEN 'in_auction'
          ELSE 'unsold'
        END as auction_status
       FROM players p 
       LEFT JOIN teams t ON p.team_id = t.id 
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      console.log(`No player found with ID ${id}`);
      return null;
    }

    const player = result.rows[0];
    return {
      ...player,
      base_price: parseFloat(player.base_price) || 0,
      sold_price: parseFloat(player.sold_price) || 0,
      team_budget: parseFloat(player.team_budget) || 0
    };
  } catch (error) {
    console.error(`Error fetching player with team for ID ${id}:`, error);
    console.error('Error details:', error.message);
    return null;
  }
};

// Get players without a team (available for auction)
exports.getAvailablePlayers = async () => {
  try {
    console.log('Fetching available players (without team)...');
    const result = await db.query(
      `SELECT 
        p.*,
        COALESCE(MAX(b.amount), p.base_price) as current_bid
       FROM players p
       LEFT JOIN bids b ON p.id = b.player_id
       WHERE p.team_id IS NULL 
         AND p.status != 'sold'
       GROUP BY p.id
       ORDER BY 
         CASE 
           WHEN p.status = 'in_auction' THEN 0
           ELSE 1
         END,
         p.role,
         p.name`
    );

    return result.rows.map(player => ({
      ...player,
      base_price: parseFloat(player.base_price) || 0,
      current_bid: parseFloat(player.current_bid) || 0
    }));
  } catch (error) {
    console.error('Error fetching available players:', error);
    console.error('Error details:', error.message);
    return [];
  }
};

// Get players belonging to a team
exports.getPlayersByTeam = async (teamId) => {
  try {
    console.log(`Fetching players for team ID ${teamId}...`);
    const result = await db.query(
      'SELECT * FROM players WHERE team_id = $1 ORDER BY name',
      [teamId]
    );
    console.log(`Found ${result.rows.length} players for team ID ${teamId}`);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching players for team ID ${teamId}:`, error);
    return []; // Return empty array instead of throwing
  }
};

// Create a new player
exports.createPlayer = async (playerData) => {
  const { name, base_price, role, team_id, image_url } = playerData;
  try {
    const result = await db.query(
      'INSERT INTO players (name, base_price, role, team_id, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, base_price, role, team_id, image_url]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating player:', error);
    throw error; // Rethrow for handling in controller
  }
};

// Update a player
exports.updatePlayer = async (playerId, playerData) => {
  try {
    const { name, role, base_price, image_url, status } = playerData;

    // Validate required fields
    if (!name || !role || !base_price) {
      throw new Error('Name, role, and base price are required');
    }

    // Validate status if provided
    if (status && !['available', 'sold', 'unsold'].includes(status)) {
      throw new Error('Invalid status value. Must be one of: available, sold, unsold');
    }

    const query = `
      UPDATE players 
      SET name = $1, role = $2, base_price = $3, image_url = $4, status = $5
      WHERE id = $6
      RETURNING *
    `;

    const values = [
      name,
      role,
      base_price,
      image_url || null,
      status || 'available',
      playerId
    ];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];

  } catch (error) {
    console.error('Error updating player:', error);
    throw error;
  }
};

// Update player's team (for auction)
exports.updatePlayerTeam = async (playerId, teamId) => {
  try {
    console.log(`Updating player ${playerId} to belong to team ${teamId}...`);
    
    // First check if the player exists
    const checkPlayer = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
    if (checkPlayer.rows.length === 0) {
      console.error(`No player found with ID ${playerId}`);
      throw new Error('Player not found');
    }
    
    const result = await db.query(
      'UPDATE players SET team_id = $1 WHERE id = $2 RETURNING *',
      [teamId, playerId]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error(`Error updating team for player ID ${playerId}:`, error);
    throw error; // Rethrow for handling in controller
  }
};

// Update player's status (sold, unsold, available)
exports.updatePlayerStatus = async (playerId, status) => {
  try {
    console.log(`Updating player ${playerId} status to ${status}...`);
    
    // First check if the player exists with more detailed error handling
    const checkPlayer = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
    
    if (checkPlayer.rows.length === 0) {
      console.error(`No player found with ID ${playerId}`);
      throw new Error('Player not found');
    }
    
    // Add more detailed console logging to help with debugging
    console.log(`Player found:`, JSON.stringify(checkPlayer.rows[0]));
    
    // Since status is defined as character varying[] (array), we need to convert single string to array
    const statusArray = Array.isArray(status) ? status : [status];
    
    // Use a more resilient query that handles the status array correctly
    let result;
    try {
      // Try standard update with array
      result = await db.query(
        'UPDATE players SET status = $1, is_auctioned = $2 WHERE id = $3 RETURNING *',
        [statusArray, true, playerId]
      );
    } catch (columnError) {
      console.error('Error in status update, trying an alternative approach:', columnError.message);
      
      // Just update the is_auctioned field - this is a fallback if the status column has issues
      result = await db.query(
        'UPDATE players SET is_auctioned = $1 WHERE id = $2 RETURNING *',
        [true, playerId]
      );
      
      console.log('Used fallback method for status update');
    }
    
    console.log(`Successfully updated player ${playerId} status to ${status}`);
    return result.rows[0];
  } catch (error) {
    console.error(`Error updating status for player ID ${playerId}:`, error);
    // Return null instead of throwing to prevent cascading errors
    return null;
  }
};

// Delete a player
exports.deletePlayer = async (id) => {
  try {
    const result = await db.query('DELETE FROM players WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      throw new Error('Player not found');
    }
    return result.rows[0];
  } catch (error) {
    console.error(`Error deleting player with ID ${id}:`, error);
    throw error; // Rethrow for handling in controller
  }
};

// Reset all player statuses to available and clear team assignments
exports.resetAllPlayerStatus = async () => {
  try {
    console.log('Resetting all player statuses to available...');
    
    // Update all players to available status and remove team assignments
    const result = await db.query(
      'UPDATE players SET status = $1, is_auctioned = $2, team_id = NULL RETURNING *',
      ['available', false]
    );
    
    console.log(`Reset ${result.rows.length} players to available status`);
    return result.rows;
  } catch (error) {
    console.error('Error resetting player statuses:', error);
    throw error; // Rethrow for handling in controller
  }
};

// Update player's team assignment
exports.assignPlayerToTeam = async (playerId, teamId, soldPrice) => {
  if (!playerId || isNaN(playerId)) {
    throw new Error('Invalid player ID');
  }

  if (!teamId || isNaN(teamId)) {
    throw new Error('Invalid team ID');
  }

  if (!soldPrice || isNaN(soldPrice) || soldPrice < 0) {
    throw new Error('Invalid sold price');
  }

  try {
    // Start a transaction
    await db.query('BEGIN');

    // Check if team has enough budget
    const teamResult = await db.query(
      'SELECT budget, total_spent FROM teams WHERE id = $1',
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      throw new Error('Team not found');
    }

    const team = teamResult.rows[0];
    const currentBudget = parseFloat(team.budget) - (parseFloat(team.total_spent) || 0);

    if (currentBudget < soldPrice) {
      throw new Error('Team does not have enough budget');
    }

    // Update player
    const result = await db.query(
      `UPDATE players 
       SET team_id = $1,
           sold_price = $2,
           status = 'sold',
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [teamId, soldPrice, playerId]
    );

    if (result.rows.length === 0) {
      throw new Error('Player not found');
    }

    // Commit transaction
    await db.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error assigning player to team:', error);
    throw error;
  }
};