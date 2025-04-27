-- Database: auction_system

-- Drop existing tables if they exist
DROP TABLE IF EXISTS bids;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS teams;

-- Teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner VARCHAR(100),
    budget INT DEFAULT 1000000
);

-- Players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_price INT NOT NULL,
    role VARCHAR(50),
    team_id INT REFERENCES teams(id),
    status VARCHAR(20) DEFAULT 'available',
    is_auctioned BOOLEAN DEFAULT false
);

-- Bids table
CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id),
    team_id INT REFERENCES teams(id),
    amount INT NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
