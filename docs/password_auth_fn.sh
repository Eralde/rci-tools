#!/bin/bash
# Authenticates an HTTP session on a Keenetic/Netcraze device using username and password.
#
# The function assumes that the following binaries are available:
# - `curl`
# - `jq`
# - `md5`
# - `shasum`
#
# Usage:
# > password_auth --username <username> --password <password> [--addr <address>]
#
# If you run this script without --username and/or --password arguments,
# it will attempt to authenticate session on the device without them
# (that will work if the password for the default user is not set).
#
password_auth() {
  # Check for required binaries
  local required_bins=("curl" "jq" "md5" "shasum")

  for bin in "${required_bins[@]}"; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      echo "Error: Required binary '$bin' is not installed or not in PATH." >&2
      return 2
    fi
  done

  local addr="192.168.1.1"
  local username=""
  local password=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --addr)
        addr="$2"
        shift 2
        ;;
      --username)
        username="$2"
        shift 2
        ;;
      --password)
        password="$2"
        shift 2
        ;;
      *)
        echo "Unknown parameter: $1"
        return 1
        ;;
    esac
  done

  DEV_ADDR="http://$addr"
  r=$(curl -si "$DEV_ADDR/auth")

  if [[ -z "$username" || -z "$password" ]]; then
    # Try auth without username/password (will work if the password for the default user is not set)
    if echo "$r" | grep -q "200 OK"; then
      echo "Authenticated (No password)"
      echo "$r" | grep -i 'Set-Cookie:' | awk '{print $2}' | cut -d';' -f1
      return 0
    else
      echo "Username/password required. Usage: password_auth --username <username> --password <password> [--addr <address>]"
      return 1
    fi
  fi

  if echo "$r" | grep -q "200 OK"; then
    echo "Authenticated (No password)"
    echo "$r" | grep -i set-cookie
  else
    token=$(echo "$r" | grep -i 'X-NDM-Challenge:' | awk '{print $2}' | tr -d '\r')
    realm=$(echo "$r" | grep -i 'X-NDM-Realm:' | cut -d' ' -f2- | tr -d '\r')
    session_cookie=$(echo "$r" | grep -i 'Set-Cookie:' | awk '{print $2}' | cut -d';' -f1)
    hash1=$(printf "%s:%s:%s" "$username" "$realm" "$password" | md5)
    hash2=$(printf "%s%s" "$token" "$hash1" | shasum -a 256 | awk '{print $1}')
    resp=$(curl -si -H "Cookie: $session_cookie" -X POST "$DEV_ADDR/auth" -H 'Content-Type: application/json' -d "{\"login\":\"$username\",\"password\":\"$hash2\"}")

    if echo "$resp" | grep -q "200 OK"; then
      echo "Authenticated (GET + POST)"
      echo "$session_cookie"
    else
      echo "Authentication failed"
    fi
  fi
}
