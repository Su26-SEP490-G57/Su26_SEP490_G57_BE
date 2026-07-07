#!/bin/bash

# Assign input arguments with default fallback values
CONTAINER_NAME=$1
MAX_ATTEMPTS=${2:-20}
SLEEP_TIME=${3:-3}
ATTEMPT=1

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ [Error] Container name argument is required!"
    echo "Usage: ./check-health.sh <container_name> [max_attempts] [sleep_seconds]"
    exit 1
fi

echo "⏳ [Healthcheck] Starting monitoring for container: $CONTAINER_NAME"

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    # Fetch current health status via docker inspect
    STATUS=$(sudo docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "starting")
    
    if [ "$STATUS" = "healthy" ]; then
        echo "✅ [Healthcheck] Container '$CONTAINER_NAME' is fully OPERATIONAL and HEALTHY!"
        exit 0
    elif [ "$STATUS" = "unhealthy" ]; then
        echo "❌ [Healthcheck] Container '$CONTAINER_NAME' has entered an UNHEALTHY state!"
        echo "📝 Dumping last 50 lines of container logs for diagnostics:"
        sudo docker logs --tail 50 "$CONTAINER_NAME"
        exit 1
    fi
    
    echo "👉 [Attempt $ATTEMPT/$MAX_ATTEMPTS] Status: '$STATUS'. Retrying in ${SLEEP_TIME}s..."
    sleep "$SLEEP_TIME"
    ATTEMPT=$((ATTEMPT + 1))
done

echo "🚨 [Healthcheck] Timeout: Container '$CONTAINER_NAME' failed to report healthy within $MAX_ATTEMPTS attempts."
echo "📝 Dumping container logs for diagnostics:"
sudo docker logs --tail 50 "$CONTAINER_NAME"
exit 1