# Cricket Auction System 🏏

A modern web application for managing cricket player auctions with real-time bidding functionality.

## ✨ Features

- **Live Auction Management** - Real-time bidding with instant updates
- **Team Dashboard** - Complete team management with budget tracking
- **Admin Controls** - Comprehensive dashboard for player and team administration
- **Detailed Analytics** - Auction results and in-depth statistics
- **Responsive Design** - Optimized experience across all devices

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| **Backend** | <img src="https://nodejs.org/static/images/logos/nodejs-icon.svg" width="20" height="20" alt="Node.js"> Node.js with <img src="https://expressjs.com/images/favicon.png" width="20" height="20" alt="Express.js"> Express.js |
| **Frontend** | <img src="https://www.w3.org/html/logo/badge/html5-badge-h-solo.png" width="20" height="20" alt="HTML"> HTML / <img src="https://cdn.worldvectorlogo.com/logos/css-3.svg" width="20" height="20" alt="CSS"> CSS / <img src="https://cdn.worldvectorlogo.com/logos/javascript-1.svg" width="20" height="20" alt="JavaScript"> JavaScript with <img src="https://ejs.co/favicon.ico" width="20" height="20" alt="EJS"> EJS templating |
| **Database** | <img src="https://www.postgresql.org/media/img/about/press/elephant.png" width="20" height="20" alt="PostgreSQL"> PostgreSQL |
| **UI Framework** | <img src="https://getbootstrap.com/docs/5.0/assets/img/favicons/favicon-32x32.png" width="20" height="20" alt="Bootstrap"> Bootstrap 5 |
| **Real-time Updates** | <img src="https://socket.io/images/favicon.png" width="20" height="20" alt="Socket.IO"> Socket.IO |

## 🚀 Installation and Setup

### Prerequisites

- Node.js (v14+)
- PostgreSQL

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DevSenghani/AuctionBid.git
   cd AuctionBid
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env` file in the root directory:
   ```
   PORT=3000
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=auction_system
   DB_PASSWORD=your_password
   DB_PORT=5432
   ```

4. **Create the database:**
   ```bash
   createdb auction_system
   ```

5. **Initialize database:**
   ```bash
   npm run init-db
   ```

6. **Start the application:**
   ```bash
   npm start
   ```
   
   For development with hot-reloading:
   ```bash
   npm run dev
   ```

7. **Access the application:** Open your browser and navigate to `http://localhost:3000`

### Database Migrations

When upgrading from a previous version: