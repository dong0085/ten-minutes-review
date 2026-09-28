#!/bin/sh
# Runs inside the `backup` service (profile `db`): one compressed pg_dump per night
# at 03:15 UTC into /backups, keeping the newest 14.
set -eu

while true; do
  now=$(date -u +%s)
  next=$(date -u -d "$(date -u +%F) 03:15" +%s)
  if [ "$next" -le "$now" ]; then
    next=$((next + 86400))
  fi
  sleep $((next - now))

  file="/backups/db-$(date -u +%F).dump"
  if pg_dump --format=custom --file="$file.partial"; then
    mv "$file.partial" "$file"
    echo "backup written: $file"
  else
    rm -f "$file.partial"
    echo "backup failed" >&2
  fi
  ls -1t /backups/db-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
done
