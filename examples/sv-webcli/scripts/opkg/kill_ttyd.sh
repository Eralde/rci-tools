#!/bin/sh
# This script is executed by lighttpd via CGI to kill all ttyd processes.

# Standard CGI headers
echo "Content-Type: application/json"
echo ""

# Kill all ttyd processes
killall ttyd 2>/dev/null

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo '{"success": true}'
else
    # killall returns 1 if no processes were found or killed
    echo '{"success": false}'
fi