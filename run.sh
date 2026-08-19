#!/usr/bin/env bash

# DriftWatch - One-Click Launcher
# Starts both FastAPI Backend (port 8000) and Next.js Frontend (port 3000)

set -e

# ANSI Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================================================${NC}"
echo -e "${CYAN}   DriftWatch - Scraper Studio & Developer Intelligence Radar          ${NC}"
echo -e "${CYAN}========================================================================${NC}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# 1. Check / Create .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}[*] Creating .env from .env.example...${NC}"
        cp .env.example .env
    fi
fi

# 2. Check / Install Python dependencies
echo -e "${BLUE}[*] Checking Python dependencies...${NC}"
python3 -m pip install -q -r requirements.txt

# 3. Check / Install Node.js dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}[*] Installing frontend dependencies (first-time setup)...${NC}"
    cd frontend && npm install && cd ..
fi

# 4. Clean shutdown handler
cleanup() {
    echo -e "\n${YELLOW}[*] Stopping DriftWatch services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}[✓] All services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 5. Start Backend Server
echo -e "${BLUE}[*] Starting FastAPI Backend on http://localhost:8000...${NC}"
python3 -m uvicorn backend.main:app --port 8000 --host 0.0.0.0 &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 6. Start Frontend Server
echo -e "${BLUE}[*] Starting Next.js Frontend on http://localhost:3000...${NC}"
cd frontend
npm run dev -- -p 3000 &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}========================================================================${NC}"
echo -e "${GREEN}   DriftWatch is Running and Ready!                                     ${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e "   • Dashboard UI:        ${CYAN}http://localhost:3000${NC}"
echo -e "   • Backend API:         ${CYAN}http://localhost:8000${NC}"
echo -e "   • API Docs (Swagger):  ${CYAN}http://localhost:8000/docs${NC}"
echo -e "${YELLOW}   Press Ctrl+C anytime to stop both services.${NC}"
echo ""

# Keep script running and wait for background processes
wait "$BACKEND_PID" "$FRONTEND_PID"
