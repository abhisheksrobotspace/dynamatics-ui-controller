#!/bin/bash
set -e

# Check if two arguments are provided
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 username@ip targetDir"
  echo "Example: $0 rs@192.168.2.180 /home/rs/apps/ifactory-os"
  exit 1
fi

TARGET=$1
TARGET_DIR=$2

echo "Building production ioware bundle..."
npm run build:ioware

echo "Syncing build files to $TARGET:$TARGET_DIR..."
rsync -avz -e ssh --delete build/ "$TARGET:$TARGET_DIR/"

echo "Restarting nginx and electron kiosk on $TARGET..."
ssh -tt "$TARGET" 'sudo systemctl restart nginx && sudo supervisorctl restart electron-app'

# Print completion message
echo "Deployment of UI to $TARGET:$TARGET_DIR completed successfully."


