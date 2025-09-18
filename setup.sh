#!/bin/bash

# FoodEx2 Validator - Initial Setup Script

echo "🚀 Setting up FoodEx2 Validator..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found:${NC} $(node --version)"

# Install backend dependencies
echo -e "\n${BLUE}Installing backend dependencies...${NC}"
npm install

# Set up database
echo -e "\n${BLUE}Setting up database...${NC}"
if [ -f "data/mtx.db" ]; then
    echo -e "${YELLOW}Database already exists. Skipping setup.${NC}"
else
    npm run setup-db
fi

# Install frontend dependencies
echo -e "\n${BLUE}Installing frontend dependencies...${NC}"
cd client && npm install && cd ..

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "\n${BLUE}Creating .env file...${NC}"
    cat > .env << EOF
PORT=5001
NODE_ENV=development
EOF
fi

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "\nTo start the application, run:"
echo -e "  ${BLUE}./start.sh${NC}          - Start both frontend and backend"
echo -e "  ${BLUE}./start-backend.sh${NC}  - Start only the backend"
echo -e "  ${BLUE}./start-frontend.sh${NC} - Start only the frontend"
echo -e "\nThe application will be available at:"
echo -e "  Frontend: ${BLUE}http://localhost:5178${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:5001${NC}"