#!/bin/sh
# This script is executed by lighttpd via CGI to spawn ttyd.

# Configuration paths
TTYD_BIN="/opt/bin/ttyd"
DAEMONIZE_BIN="/opt/bin/daemonize"

# Standard CGI headers
echo "Content-Type: application/json"
echo ""

TTYD_PORT=7681

# Spawn ttyd on the specified port using daemonize
if ! $DAEMONIZE_BIN $TTYD_BIN -p "$TTYD_PORT" -W ndmc; then
    echo '{"success": false, "error": "Failed to spawn ttyd."}'
    exit 1
fi

echo "{\"success\": true, \"port\": $TTYD_PORT}"
