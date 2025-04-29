-- Cricket Auction System Database Schema
-- This schema is designed for PostgreSQL

-- Drop existing tables if they exist
DROP TABLE IF EXISTS bids;
DROP TABLE IF EXISTS auction_results;
DROP TABLE IF EXISTS auction_summary;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS auction;

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    owner VARCHAR(100),
    password VARCHAR(100) NOT NULL,
    budget DECIMAL(12, 2) DEFAULT 8000000,
    logo TEXT
    
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    base_price DECIMAL(12, 2) NOT NULL,
    team_id INTEGER REFERENCES teams(id),
    sold_price DECIMAL(12, 2),
    image_url TEXT,
    status VARCHAR(20)[] DEFAULT ARRAY['available']::VARCHAR[],
    is_auctioned BOOLEAN DEFAULT FALSE
);

-- Auction table to track auction status
CREATE TABLE IF NOT EXISTS auction (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status VARCHAR(20) DEFAULT 'not_started',
    current_player_id INTEGER REFERENCES players(id)
);

-- Bids table to track all bids
CREATE TABLE IF NOT EXISTS bids (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    team_id INTEGER NOT NULL REFERENCES teams(id),
    amount DECIMAL(12, 2) NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auction summary table to store completed auction data
CREATE TABLE IF NOT EXISTS auction_summary (
    id SERIAL PRIMARY KEY,
    end_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_by VARCHAR(100),
    total_amount DECIMAL(12, 2),
    players_sold INTEGER
);

-- Auction results table to store individual player sale results
CREATE TABLE IF NOT EXISTS auction_results (
    id SERIAL PRIMARY KEY,
    auction_summary_id INTEGER NOT NULL REFERENCES auction_summary(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    team_id INTEGER REFERENCES teams(id),
    amount DECIMAL(12, 2),
    status VARCHAR(20) DEFAULT 'sold'
);

-- Initialize auction record
INSERT INTO auction (id, status, current_player_id) 
VALUES (1, 'not_started', NULL)
ON CONFLICT (id) DO NOTHING;

-- Add indexes for performance
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_status ON players(status);
CREATE INDEX idx_bids_player_id ON bids(player_id);
CREATE INDEX idx_bids_team_id ON bids(team_id);
CREATE INDEX idx_auction_results_auction_summary_id ON auction_results(auction_summary_id);
CREATE INDEX idx_auction_results_player_id ON auction_results(player_id);
CREATE INDEX idx_auction_results_team_id ON auction_results(team_id);

-- Insert teams data
INSERT INTO teams (name, budget, logo, owner, password) VALUES
('Mumbai Indians', 9000000.00, 'mi_logo.png', 'Mukesh Ambani', 'mi2023'),
('Chennai Super Kings', 8500000.00, 'csk_logo.png', 'N. Srinivasan', 'csk2023'),
('Royal Challengers Bangalore', 8700000.00, 'rcb_logo.png', 'Vijay Mallya', 'rcb2023'),
('Kolkata Knight Riders', 8800000.00, 'kkr_logo.png', 'Shah Rukh Khan', 'kkr2023'),
('Delhi Capitals', 8600000.00, 'dc_logo.png', 'GMR Group', 'dc2023'),
('Rajasthan Royals', 8400000.00, 'rr_logo.png', 'Manoj Badale', 'rr2023'),
('Sunrisers Hyderabad', 8300000.00, 'srh_logo.png', 'Sun TV Network', 'srh2023'),
('Punjab Kings', 8900000.00, 'pbks_logo.png', 'Preity Zinta', 'pbks2023'),
('Gujarat Titans', 9100000.00, 'gt_logo.png', 'CVC Capital', 'gt2023'),
('Lucknow Super Giants', 9200000.00, 'lsg_logo.png', 'RPSG Group', 'lsg2023')
ON CONFLICT (name) DO NOTHING;

-- Insert players data
INSERT INTO players (name, role, base_price, status) VALUES
('Virat Kohli', 'Batsman', 200000.00, ARRAY['unsold']),
('Rohit Sharma', 'Batsman', 200000.00, ARRAY['unsold']),
('MS Dhoni', 'Wicketkeeper', 180000.00, ARRAY['unsold']),
('Jasprit Bumrah', 'Bowler', 170000.00, ARRAY['unsold']),
('Ravindra Jadeja', 'All-rounder', 160000.00, ARRAY['unsold']),
('KL Rahul', 'Batsman', 150000.00, ARRAY['unsold']),
('Hardik Pandya', 'All-rounder', 160000.00, ARRAY['unsold']),
('Rishabh Pant', 'Wicketkeeper', 140000.00, ARRAY['unsold']),
('Yuzvendra Chahal', 'Bowler', 120000.00, ARRAY['unsold']),
('Shikhar Dhawan', 'Batsman', 130000.00, ARRAY['unsold']),
('Bhuvneshwar Kumar', 'Bowler', 110000.00, ARRAY['unsold']),
('Suryakumar Yadav', 'Batsman', 140000.00, ARRAY['unsold']),
('Ravichandran Ashwin', 'Bowler', 130000.00, ARRAY['unsold']),
('Mohammed Shami', 'Bowler', 120000.00, ARRAY['unsold']),
('Shreyas Iyer', 'Batsman', 130000.00, ARRAY['unsold'])
ON CONFLICT (name) DO NOTHING;
