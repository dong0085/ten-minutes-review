#!/bin/bash
# Runs on the worker VM as root: replaces the running worker with image tmr-worker:<tag>,
# waits for its health check, and keeps the three newest images for rollback.
# Usage: restart.sh <tag>
set -euo pipefail

tag="$1"
image="tmr-worker:${tag}"

docker image inspect "$image" > /dev/null

# SIGTERM lets the worker finish its current job; the queue holds anything left over.
if docker container inspect tmr-worker > /dev/null 2>&1; then
  docker stop --time 120 tmr-worker
  docker rm tmr-worker
fi

docker run -d \
  --name tmr-worker \
  --restart unless-stopped \
  --env-file /etc/tmr/worker.env \
  --env PORT=3000 \
  --log-driver local \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  "$image"

status="starting"
for _ in $(seq 1 24); do
  sleep 5
  status="$(docker inspect --format '{{.State.Health.Status}}' tmr-worker)"
  if [ "$status" = "healthy" ]; then
    break
  fi
done

if [ "$status" != "healthy" ]; then
  echo "worker is ${status} after two minutes" >&2
  docker logs --tail 80 tmr-worker >&2
  exit 1
fi

echo "worker ${tag} is healthy"
docker images tmr-worker --format '{{.Repository}}:{{.Tag}}' | tail -n +4 | xargs -r docker rmi
