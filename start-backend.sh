#!/bin/bash

# Start only the backend server

echo "🚀 Starting FoodEx2 Validator Backend..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if database exists
if [ ! -f "data/mtx.db" ]; then
    echo "Database not found. Running setup..."
    npm run setup-db
fi

echo "Starting backend server on port 5001..."
npm start