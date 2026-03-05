#!/bin/bash

set -e

echo "Updating system..."
apt update

echo "Installing dependencies..."
apt install -y git curl

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
