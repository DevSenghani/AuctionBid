-- Add missing columns to players table for auction functionality
ALTER TABLE players ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available';
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_auctioned BOOLEAN DEFAULT false;

-- Update existing records
UPDATE players SET status = 'available' WHERE status IS NULL;
UPDATE players SET is_auctioned = false WHERE is_auctioned IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_players_is_auctioned ON players(is_auctioned); 