#!/bin/bash

# Team Build Pro - Email Campaign Control Script
# Manage automated email campaigns

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_DIR/logs/scheduler.pid"
LOG_FILE="$PROJECT_DIR/logs/campaign-control.log"

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

start_scheduler() {
    if [ -f "$PID_FILE" ] && ps -p "$(cat "$PID_FILE")" > /dev/null 2>&1; then
        log "⚠️  Scheduler is already running (PID: $(cat "$PID_FILE"))"
        return 1
    fi
    
    log "🚀 Starting email campaign scheduler..."
    
    # Start the simple scheduler in background
    cd "$PROJECT_DIR"
    nohup node simple-scheduler.js > logs/scheduler-output.log 2>&1 &
    SCHEDULER_PID=$!
    
    # Save PID
    echo $SCHEDULER_PID > "$PID_FILE"
    
    log "✅ Scheduler started (PID: $SCHEDULER_PID)"
    log "📝 Monitor logs: tail -f $PROJECT_DIR/logs/simple-scheduler.log"
}

stop_scheduler() {
    if [ ! -f "$PID_FILE" ]; then
        log "⚠️  No PID file found. Scheduler may not be running."
        return 1
    fi
    
    PID=$(cat "$PID_FILE")
    
    if ps -p "$PID" > /dev/null 2>&1; then
        log "🛑 Stopping scheduler (PID: $PID)..."
        kill "$PID"
        rm -f "$PID_FILE"
        log "✅ Scheduler stopped"
    else
        log "⚠️  Scheduler process not found (PID: $PID)"
        rm -f "$PID_FILE"
    fi
}

status_scheduler() {
    if [ -f "$PID_FILE" ] && ps -p "$(cat "$PID_FILE")" > /dev/null 2>&1; then
        PID=$(cat "$PID_FILE")
        log "✅ Scheduler is running (PID: $PID)"
        
        # Show recent log entries
        if [ -f "$PROJECT_DIR/logs/simple-scheduler.log" ]; then
            echo ""
            echo "📝 Recent log entries:"
            tail -n 5 "$PROJECT_DIR/logs/simple-scheduler.log"
        fi
    else
        log "❌ Scheduler is not running"
        [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
    fi
}

restart_scheduler() {
    log "🔄 Restarting scheduler..."
    stop_scheduler
    sleep 2
    start_scheduler
}

show_help() {
    echo "Team Build Pro - Email Campaign Control"
    echo "Usage: $0 {start|stop|restart|status|logs|test}"
    echo ""
    echo "Commands:"
    echo "  start    - Start the email campaign scheduler"
    echo "  stop     - Stop the scheduler"
    echo "  restart  - Restart the scheduler"
    echo "  status   - Check if scheduler is running"
    echo "  logs     - Show recent logs"
    echo "  test     - Run a single campaign manually"
    echo ""
}

show_logs() {
    if [ -f "$PROJECT_DIR/logs/simple-scheduler.log" ]; then
        echo "📝 Email Campaign Scheduler Logs:"
        echo "=================================="
        tail -n 20 "$PROJECT_DIR/logs/simple-scheduler.log"
    else
        echo "❌ No log file found"
    fi
}

run_test() {
    log "🧪 Running test campaign..."
    cd "$PROJECT_DIR"
    node run-email-campaign.js batch 5 --test
}

# Main command handling
case "$1" in
    start)
        start_scheduler
        ;;
    stop)
        stop_scheduler
        ;;
    restart)
        restart_scheduler
        ;;
    status)
        status_scheduler
        ;;
    logs)
        show_logs
        ;;
    test)
        run_test
        ;;
    *)
        show_help
        exit 1
        ;;
esac