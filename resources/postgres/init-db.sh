#!/bin/bash
set -euo pipefail

function create_env_db() {
    local env_name=$1
    local db_password=$2

    echo "Creating DB and User for environment: $env_name"
    
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        CREATE USER poms_$env_name WITH PASSWORD '$db_password';
        CREATE DATABASE poms_$env_name OWNER poms_$env_name;
        GRANT ALL PRIVILEGES ON DATABASE poms_$env_name TO poms_$env_name;
EOSQL

    echo "🔍 [Verification] Testing connection for user '$target_user' to database '$target_db'..."

    # 2. Test the connection using PGPASSWORD to pass the credentials non-interactively
    # -c "SELECT 1" is a lightweight query just to verify authentication and connection
    if PGPASSWORD="$db_password" psql -h localhost -U "$target_user" -d "$target_db" -c "SELECT 1" > /dev/null 2>&1; then
        echo "✅ [Verification] Successfully authenticated! Connection verified for '$target_user'."
    else
        echo "❌ [Verification Error] Failed to connect to '$target_db' using user '$target_user'!"
        echo "🚨 [Critical] Aborting database initialization due to verification failure."
        exit 1
    fi
    echo "------------------------------------------------------------"
}

create_env_db "dev" "$DEV_DB_PASSWORD"
create_env_db "staging" "$STAGING_DB_PASSWORD"
create_env_db "prod" "$PROD_DB_PASSWORD"