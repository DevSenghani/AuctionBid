const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'cricket_auction.db'));

// Create tables if they don't exist
db.serialize(() => {
    // Teams table
    db.run(`CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        budget REAL DEFAULT 8000000,
        logo TEXT
    )`);

    // Players table
    db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        image TEXT,
        base_price REAL NOT NULL,
        team_id INTEGER NULL,
        sold_amount REAL NULL,
        status TEXT DEFAULT 'unsold',
        FOREIGN KEY (team_id) REFERENCES teams(id)
    )`);

    // Auction table
    db.run(`CREATE TABLE IF NOT EXISTS auction (
        id INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'not_started',
        current_player_id INTEGER NULL,
        FOREIGN KEY (current_player_id) REFERENCES players(id)
    )`);

    // Bids table
    db.run(`CREATE TABLE IF NOT EXISTS bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (team_id) REFERENCES teams(id)
    )`);

    // Initialize auction status if not exists
    db.get(`SELECT COUNT(*) as count FROM auction`, (err, row) => {
        if (err) {
            console.error("Error checking auction table:", err);
            return;
        }
        if (row.count === 0) {
            db.run(`INSERT INTO auction (id, status) VALUES (1, 'not_started')`);
        }
    });
});

// Team functions
function getTeams() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, name, budget, logo FROM teams`, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

function getTeamById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id, name, budget, logo FROM teams WHERE id = ?`, [id], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

function createTeam(name, password, logo) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO teams (name, password, logo) VALUES (?, ?, ?)`, 
            [name, password, logo], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ id: this.lastID, name, logo });
            }
        );
    });
}

function authenticateTeam(name, password) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id, name, budget, logo FROM teams WHERE name = ? AND password = ?`, 
            [name, password], 
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            }
        );
    });
}

// Player functions
function getPlayers() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT p.id, p.name, p.role, p.image, p.base_price, p.status, 
                p.team_id, p.sold_amount, t.name as team_name 
                FROM players p 
                LEFT JOIN teams t ON p.team_id = t.id`, 
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            }
        );
    });
}

function getPlayerById(id) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT p.id, p.name, p.role, p.image, p.base_price, p.status, 
                p.team_id, p.sold_amount, t.name as team_name 
                FROM players p 
                LEFT JOIN teams t ON p.team_id = t.id 
                WHERE p.id = ?`, 
            [id], 
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            }
        );
    });
}

function getUnsoldPlayers() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, name, role, image, base_price 
                FROM players 
                WHERE status = 'unsold'`, 
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            }
        );
    });
}

function createPlayer(name, role, image, base_price) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO players (name, role, image, base_price) VALUES (?, ?, ?, ?)`, 
            [name, role, image, base_price], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ id: this.lastID, name, role, image, base_price });
            }
        );
    });
}

// Auction functions
function getAuctionStatus() {
    return new Promise((resolve, reject) => {
        db.get(`SELECT a.status, a.current_player_id, 
                p.name as current_player_name, p.role as current_player_role,
                p.image as current_player_image, p.base_price as current_player_base_price
                FROM auction a
                LEFT JOIN players p ON a.current_player_id = p.id
                WHERE a.id = 1`, 
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            }
        );
    });
}

function startAuction(playerId) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE auction SET status = 'running', current_player_id = ? WHERE id = 1`, 
            [playerId], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                db.run(`UPDATE players SET status = 'on_auction' WHERE id = ?`, 
                    [playerId], 
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        getAuctionStatus().then(resolve).catch(reject);
                    }
                );
            }
        );
    });
}

function pauseAuction() {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE auction SET status = 'paused' WHERE id = 1`, 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                getAuctionStatus().then(resolve).catch(reject);
            }
        );
    });
}

function endAuction() {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE auction SET status = 'ended', current_player_id = NULL WHERE id = 1`, 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                getAuctionStatus().then(resolve).catch(reject);
            }
        );
    });
}

// Bid functions
function getBidsByPlayerId(playerId) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT b.id, b.player_id, b.team_id, b.amount, b.timestamp,
                t.name as team_name
                FROM bids b
                JOIN teams t ON b.team_id = t.id
                WHERE b.player_id = ?
                ORDER BY b.amount DESC`, 
            [playerId], 
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            }
        );
    });
}

function placeBid(playerId, teamId, amount) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO bids (player_id, team_id, amount) VALUES (?, ?, ?)`, 
            [playerId, teamId, amount], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                db.get(`SELECT b.id, b.player_id, b.team_id, b.amount, b.timestamp,
                        t.name as team_name
                        FROM bids b
                        JOIN teams t ON b.team_id = t.id
                        WHERE b.id = ?`, 
                    [this.lastID], 
                    (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(row);
                    }
                );
            }
        );
    });
}

function finalizeSale(playerId, teamId, amount) {
    return new Promise((resolve, reject) => {
        // Update player as sold
        db.run(`UPDATE players SET status = 'sold', team_id = ?, sold_amount = ? WHERE id = ?`, 
            [teamId, amount, playerId], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Update team's budget
                db.run(`UPDATE teams SET budget = budget - ? WHERE id = ?`, 
                    [amount, teamId], 
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // Reset current auction
                        db.run(`UPDATE auction SET current_player_id = NULL WHERE id = 1`, 
                            function(err) {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                
                                getPlayerById(playerId).then(resolve).catch(reject);
                            }
                        );
                    }
                );
            }
        );
    });
}

function markPlayerUnsold(playerId) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE players SET status = 'unsold' WHERE id = ?`, 
            [playerId], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Reset current auction
                db.run(`UPDATE auction SET current_player_id = NULL WHERE id = 1`, 
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        getPlayerById(playerId).then(resolve).catch(reject);
                    }
                );
            }
        );
    });
}

function getRecentSales() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT p.id, p.name, p.role, p.image, p.sold_amount, 
                t.id as team_id, t.name as team_name, t.logo as team_logo
                FROM players p
                JOIN teams t ON p.team_id = t.id
                WHERE p.status = 'sold'
                ORDER BY p.id DESC
                LIMIT 5`, 
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            }
        );
    });
}

module.exports = {
    getTeams,
    getTeamById,
    createTeam,
    authenticateTeam,
    getPlayers,
    getPlayerById,
    getUnsoldPlayers,
    createPlayer,
    getAuctionStatus,
    startAuction,
    pauseAuction,
    endAuction,
    getBidsByPlayerId,
    placeBid,
    finalizeSale,
    markPlayerUnsold,
    getRecentSales
}; 