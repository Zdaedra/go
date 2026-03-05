#!/bin/bash

set -e

echo "Updating system..."
apt update

echo "Installing dependencies if needed..."
if ! command -v git &> /dev/null || ! command -v curl &> /dev/null || ! command -v docker &> /dev/null; then
    apt install -y git curl docker.io docker-compose || echo "Apt install failed, but continuing..."
fi

echo "Starting docker..."
systemctl start docker
systemctl enable docker

echo "Preparing workspace..."
mkdir -p /workspace
cd /workspace

if [ ! -d "go" ]; then
    echo "Cloning repository..."
    git clone https://github.com/Zdaedra/go
fi

cd go

echo "Pulling latest code..."
git pull

echo "Starting services..."
# We run the worker specific compose for Vast nodes
docker compose -f docker-compose.worker.yml up -d --build

echo "Setup complete."
