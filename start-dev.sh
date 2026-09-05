#!/bin/bash
# Start both Backend and Frontend in one command
# Usage: ./start-dev.sh  OR  bash start-dev.sh

echo "[Cartify Dev] Starting Backend on :5000 and Frontend on :5173..."
echo "[Cartify Dev] Press Ctrl+C to stop both."
echo ""

# Trap SIGINT/SIGTERM and kill both child processes
trap 'kill 0' SIGINT SIGTERM EXIT

# Start backend in background
(cd Backend && npm run dev) &
BACKEND_PID=$!

# Give backend a moment to initialize
sleep 3

# Start frontend in background
(cd Frontend && npm run dev) &
FRONTEND_PID=$!

echo "[Cartify Dev] Backend PID:  $BACKEND_PID"
echo "[Cartify Dev] Frontend PID: $FRONTEND_PID"
echo "[Cartify Dev] Open http://localhost:5173 in your browser."

# Wait for any process to exit
wait -n
exit 0
