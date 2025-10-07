#!/bin/bash

# Techno Tribe Backend Startup Script

echo "🚀 Starting Techno Tribe Backend Server..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Please copy .env.example to .env and configure your MongoDB connection string"
    echo "   cp .env.example .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🌟 Starting server..."
if [ "$NODE_ENV" = "production" ]; then
    npm start
else
    npm run dev
fi


