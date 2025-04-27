# Cricket Auction System

A web application for managing cricket player auctions with real-time bidding functionality.

## Features

- Player auction management with real-time bidding
- Team management with budget tracking
- Admin dashboard for adding and managing players and teams
- Auction results and statistics
- Responsive design for all devices

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: HTML/CSS/JavaScript with EJS templating
- **Database**: PostgreSQL
- **Styles**: Bootstrap 5

## Installation and Setup

### Prerequisites

- Node.js (v14+)
- PostgreSQL

### Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/cricket-auction.git
   cd cricket-auction
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following content (adjust as needed):
   ```
   PORT=3000
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=auction_system
   DB_PASSWORD=your_password
   DB_PORT=5432
   ```

4. Create the PostgreSQL database:
   ```
   createdb auction_system
   ```

5. Initialize the database with tables and sample data:
   ```
   npm run init-db
   ```

6. Start the application:
   ```
   npm start
   ```
   
   For development mode with automatic reloading:
   ```
   npm run dev
   ```

7. Open your browser and navigate to `http://localhost:3000`

### Database Migrations

If you're upgrading from a previous version, you may need to run database migrations to add new columns:

1. Run the migration script to add auction-related columns to the players table:
   ```
   npm run migrate
   ```

   Or manually using psql:
   ```
   psql -U postgres -d auction_system -f scripts/add_player_columns.sql
   ```

## Usage

### Admin Dashboard

Navigate to `/admin` to:
- Add new teams
- Add new players
- Reset player auctions
- Delete teams or players

### Auction

The main auction page allows you to:
- Select a player for auction
- Place bids for different teams
- Finalize auctions to assign players to teams

### Teams

View all teams and their players.

### Results

View auction results and statistics including:
- Teams with their acquired players
- Most expensive players
- Role distribution by team
- Team spending summary

## License

[MIT License](LICENSE)

## Author

Your Name