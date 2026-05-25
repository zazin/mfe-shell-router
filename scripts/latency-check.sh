#!/usr/bin/env bash
set -euo pipefail

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

check_endpoint() {
  local url="$1"
  local label="$2"
  local marker="$3"
  local body_file="$TMP_DIR/${label}.html"

  local metrics
  metrics=$(curl -sS -L -o "$body_file"     -w '{"label":"%s","url":"%s","http_code":%{response_code},"remote_ip":"%{remote_ip}","time_namelookup":%{time_namelookup},"time_connect":%{time_connect},"time_appconnect":%{time_appconnect},"time_starttransfer":%{time_starttransfer},"time_total":%{time_total},"size_download":%{size_download}}'     "$url")

  printf "$metrics
" "$label" "$url"

  if ! grep -q "$marker" "$body_file"; then
    echo "Marker '$marker' was not found in $url" >&2
    exit 1
  fi
}

check_endpoint "https://mfe.zazin.workers.dev/" "shell" "Microfrontend edge router"
check_endpoint "https://mfe.zazin.workers.dev/account" "account" "Account overview"
check_endpoint "https://mfe.zazin.workers.dev/order" "order" "Order command center"
