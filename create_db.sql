-- Create database if it doesn't exist
SELECT 'CREATE DATABASE optiwms' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'optiwms')\gexec

-- Create user if it doesn't exist
DO $$ BEGIN
    CREATE ROLE optiwms WITH LOGIN PASSWORD 'optiwms';
EXCEPTION WHEN DUPLICATE_OBJECT THEN
    RAISE NOTICE 'Role optiwms already exists';
END $$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE optiwms TO optiwms;
