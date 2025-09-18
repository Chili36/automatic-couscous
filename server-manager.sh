#!/bin/bash

# FoodEx2 Validator Server Manager
# Manages frontend (port 5178) and backend (port 5001) servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_PORT=5178
BACKEND_PORT=5001
FRONTEND_PID_FILE=".frontend.pid"
BACKEND_PID_FILE=".backend.pid"
FRONTEND_LOG="frontend.log"
BACKEND_LOG="backend.log"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to get PID using port
get_pid_by_port() {
    local port=$1
    lsof -t -i :$port 2>/dev/null
}

# Function to check if process is running
is_running() {
    local pid=$1
    if [ -z "$pid" ]; then
        return 1
    fi
    kill -0 $pid 2>/dev/null
}

# Function to read PID from file
read_pid() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        cat "$pid_file" 2>/dev/null
    fi
}

# Function to start backend
start_backend() {
    echo -e "${BLUE}🔍 Checking backend server...${NC}"
    
    # Check if already running
    local pid=$(read_pid "$BACKEND_PID_FILE")
    if [ -n "$pid" ] && is_running $pid; then
        echo -e "${GREEN}✅ Backend already running (PID: $pid)${NC}"
        return 0
    fi
    
    # Check port availability
    if check_port $BACKEND_PORT; then
        local blocking_pid=$(get_pid_by_port $BACKEND_PORT)
        echo -e "${RED}❌ Port $BACKEND_PORT already in use by PID: $blocking_pid${NC}"
        echo -e "${YELLOW}   Run './server-manager.sh stop' or 'kill $blocking_pid'${NC}"
        return 1
    fi
    
    # Start backend
    echo -e "${BLUE}🚀 Starting backend on port $BACKEND_PORT...${NC}"
    nohup node server/index.js > "$BACKEND_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$BACKEND_PID_FILE"
    
    # Wait a moment and verify
    sleep 2
    if is_running $pid; then
        echo -e "${GREEN}✅ Backend started (PID: $pid)${NC}"
        echo -e "   Logs: $BACKEND_LOG"
        return 0
    else
        echo -e "${RED}❌ Backend failed to start. Check logs: $BACKEND_LOG${NC}"
        rm -f "$BACKEND_PID_FILE"
        return 1
    fi
}

# Function to start frontend
start_frontend() {
    echo -e "${BLUE}🔍 Checking frontend server...${NC}"
    
    # Check if already running
    local pid=$(read_pid "$FRONTEND_PID_FILE")
    if [ -n "$pid" ] && is_running $pid; then
        echo -e "${GREEN}✅ Frontend already running (PID: $pid)${NC}"
        return 0
    fi
    
    # Check port availability
    if check_port $FRONTEND_PORT; then
        local blocking_pid=$(get_pid_by_port $FRONTEND_PORT)
        echo -e "${RED}❌ Port $FRONTEND_PORT already in use by PID: $blocking_pid${NC}"
        echo -e "${YELLOW}   Run './server-manager.sh stop' or 'kill $blocking_pid'${NC}"
        return 1
    fi
    
    # Start frontend
    echo -e "${BLUE}🚀 Starting frontend on port $FRONTEND_PORT...${NC}"
    cd client
    nohup npm run dev > "../$FRONTEND_LOG" 2>&1 &
    local pid=$!
    cd ..
    echo $pid > "$FRONTEND_PID_FILE"
    
    # Wait a moment and verify
    sleep 3
    if is_running $pid; then
        echo -e "${GREEN}✅ Frontend started (PID: $pid)${NC}"
        echo -e "   Logs: $FRONTEND_LOG"
        return 0
    else
        echo -e "${RED}❌ Frontend failed to start. Check logs: $FRONTEND_LOG${NC}"
        rm -f "$FRONTEND_PID_FILE"
        return 1
    fi
}

# Function to stop a server
stop_server() {
    local name=$1
    local pid_file=$2
    local port=$3
    
    echo -e "${BLUE}🛑 Stopping $name...${NC}"
    
    # Try PID file first
    local pid=$(read_pid "$pid_file")
    if [ -n "$pid" ] && is_running $pid; then
        kill $pid 2>/dev/null
        sleep 1
        if is_running $pid; then
            kill -9 $pid 2>/dev/null
        fi
        echo -e "${GREEN}✅ $name stopped (PID: $pid)${NC}"
    else
        # Try to find by port
        local port_pid=$(get_pid_by_port $port)
        if [ -n "$port_pid" ]; then
            echo -e "${YELLOW}⚠️  Found process on port $port (PID: $port_pid)${NC}"
            kill $port_pid 2>/dev/null
            sleep 1
            if is_running $port_pid; then
                kill -9 $port_pid 2>/dev/null
            fi
            echo -e "${GREEN}✅ $name stopped${NC}"
        else
            echo -e "${YELLOW}ℹ️  $name was not running${NC}"
        fi
    fi
    
    # Clean up PID file
    rm -f "$pid_file"
}

# Function to check status
check_status() {
    echo -e "${BLUE}📊 FoodEx2 Validator Server Status${NC}\n"
    
    # Check backend
    local backend_pid=$(read_pid "$BACKEND_PID_FILE")
    if [ -n "$backend_pid" ] && is_running $backend_pid; then
        echo -e "${GREEN}✅ Backend: Running (PID: $backend_pid, Port: $BACKEND_PORT)${NC}"
    elif check_port $BACKEND_PORT; then
        local port_pid=$(get_pid_by_port $BACKEND_PORT)
        echo -e "${YELLOW}⚠️  Backend: Port $BACKEND_PORT in use by different process (PID: $port_pid)${NC}"
    else
        echo -e "${RED}❌ Backend: Not running${NC}"
    fi
    
    # Check frontend
    local frontend_pid=$(read_pid "$FRONTEND_PID_FILE")
    if [ -n "$frontend_pid" ] && is_running $frontend_pid; then
        echo -e "${GREEN}✅ Frontend: Running (PID: $frontend_pid, Port: $FRONTEND_PORT)${NC}"
    elif check_port $FRONTEND_PORT; then
        local port_pid=$(get_pid_by_port $FRONTEND_PORT)
        echo -e "${YELLOW}⚠️  Frontend: Port $FRONTEND_PORT in use by different process (PID: $port_pid)${NC}"
    else
        echo -e "${RED}❌ Frontend: Not running${NC}"
    fi
}

# Main command handler
case "$1" in
    start)
        echo -e "${BLUE}🚀 Starting FoodEx2 Validator servers...${NC}\n"
        start_backend
        backend_result=$?
        echo
        start_frontend
        frontend_result=$?
        
        if [ $backend_result -eq 0 ] && [ $frontend_result -eq 0 ]; then
            echo -e "\n${GREEN}✨ All servers started successfully!${NC}"
            echo -e "   Frontend: http://localhost:$FRONTEND_PORT"
            echo -e "   Backend:  http://localhost:$BACKEND_PORT"
        fi
        ;;
        
    stop)
        echo -e "${BLUE}🛑 Stopping FoodEx2 Validator servers...${NC}\n"
        stop_server "Frontend" "$FRONTEND_PID_FILE" $FRONTEND_PORT
        echo
        stop_server "Backend" "$BACKEND_PID_FILE" $BACKEND_PORT
        echo -e "\n${GREEN}✅ All servers stopped${NC}"
        ;;
        
    restart)
        echo -e "${BLUE}🔄 Restarting FoodEx2 Validator servers...${NC}\n"
        $0 stop
        echo -e "\n${YELLOW}⏳ Waiting before restart...${NC}\n"
        sleep 2
        $0 start
        ;;
        
    status)
        check_status
        ;;
        
    logs)
        case "$2" in
            frontend)
                echo -e "${BLUE}📜 Frontend logs ($FRONTEND_LOG):${NC}\n"
                tail -f "$FRONTEND_LOG"
                ;;
            backend)
                echo -e "${BLUE}📜 Backend logs ($BACKEND_LOG):${NC}\n"
                tail -f "$BACKEND_LOG"
                ;;
            *)
                echo "Usage: $0 logs [frontend|backend]"
                ;;
        esac
        ;;
        
    *)
        echo -e "${BLUE}FoodEx2 Validator Server Manager${NC}\n"
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  start    - Start both frontend and backend servers"
        echo "  stop     - Stop both servers"
        echo "  restart  - Restart both servers"
        echo "  status   - Check server status"
        echo "  logs [frontend|backend] - Tail server logs"
        ;;
esac