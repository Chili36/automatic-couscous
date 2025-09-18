#!/bin/bash

# FoodEx2 Validator - Start Script
# This script starts both the backend server and frontend

echo "🚀 Starting FoodEx2 Validator..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd client && npm install && cd ..
fi

# Check if database exists
if [ ! -f "data/mtx.db" ]; then
    echo -e "${YELLOW}Database not found. Running setup...${NC}"
    npm run setup-db
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"
    pkill -P $$
    exit
}

trap cleanup INT TERM

# Start backend server
echo -e "${GREEN}Starting backend server on port 5001...${NC}"
npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend dev server
echo -e "${BLUE}Starting frontend on port 5178...${NC}"
cd client && npm run dev &
FRONTEND_PID=$!

echo -e "\n${GREEN}✅ FoodEx2 Validator is running!${NC}"
echo -e "${BLUE}📍 Frontend: http://localhost:5178${NC}"
echo -e "${BLUE}📍 Backend API: http://localhost:5001${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all servers${NC}\n"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID