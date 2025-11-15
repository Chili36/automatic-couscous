#!/bin/bash

# Database Backup Script
# Creates timestamped backup of the mtx.db database

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DB_PATH="$PROJECT_DIR/data/mtx.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Get current database version
VERSION=$(sqlite3 "$DB_PATH" "SELECT version FROM catalogue WHERE code = 'MTX'" 2>/dev/null || echo "unknown")

# Create timestamped backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mtx_v${VERSION}_backup_${TIMESTAMP}.db"

echo "Backing up database..."
echo "Source: $DB_PATH"
echo "Destination: $BACKUP_FILE"

cp "$DB_PATH" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Backup created successfully!"
    echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"

    # List recent backups
    echo ""
    echo "Recent backups:"
    ls -lht "$BACKUP_DIR" | head -6
else
    echo "✗ Backup failed!"
    exit 1
fi
