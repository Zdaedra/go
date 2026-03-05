#!/bin/bash
# UFW setup for Vast GPU node

# 1. Reset UFW
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# 2. Allow SSH via internal port 22 (because Vast NATs external 15841 to 22)
ufw allow 22/tcp

# 3. Allow Orchestrator API port 8000 ONLY from Hetzner IP
ufw allow from 89.167.122.76 to any port 8000 proto tcp

# 4. Enable UFW
ufw --force enable

echo "UFW configured:"
ufw status verbose
