#!/bin/bash

# Start only the frontend dev server

echo "🚀 Starting FoodEx2 Validator Frontend..."

cd client

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Starting Vite dev server on port 5178..."
npm run dev