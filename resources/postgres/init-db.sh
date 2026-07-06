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
}

create_env_db "dev" "$DEV_DB_PASSWORD"
create_env_db "staging" "$STAGING_DB_PASSWORD"
create_env_db "prod" "$PROD_DB_PASSWORD"