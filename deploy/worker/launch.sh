#!/bin/bash
# First-boot setup for the worker VM (Lightsail Ubuntu 24.04, runs as root).
# Passed as the instance launch script; see docs/DEPLOY-AWS.md → "Worker on Lightsail".
set -euxo pipefail

# 1 GB of swap gives the 512 MB nano bundle headroom for tsx and deploy-time image loads.
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io unattended-upgrades
systemctl enable --now docker

# Security updates install daily; a reboot, when one is needed, happens at 04:00 UTC,
# well clear of the 11:00/12:00 UTC quiz send. The container restarts with Docker.
cat > /etc/apt/apt.conf.d/52tmr-auto-reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF

# The worker's environment lives here, readable by root only.
install -d -m 700 /etc/tmr
install -m 600 /dev/null /etc/tmr/worker.env
