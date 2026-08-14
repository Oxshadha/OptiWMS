import sys
from sqlalchemy import create_engine, text

DB_URL = "postgresql://optiwms:optiwms@localhost:5434/optiwms"

def reset_db():
    try:
        engine = create_engine(DB_URL, isolation_level="AUTOCOMMIT")
        with engine.connect() as conn:
            # Terminate other connections so we can drop the schema safely
            conn.execute(text("""
                SELECT pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE datname = 'optiwms' AND pid <> pg_backend_pid();
            """))
            
            # Drop and recreate the public schema
            print("Dropping schema 'public'...")
            conn.execute(text("DROP SCHEMA public CASCADE;"))
            print("Recreating schema 'public'...")
            conn.execute(text("CREATE SCHEMA public;"))
            
            print("\n✅ Database has been successfully wiped!")
            print("You can now start your Spring Boot server and Flyway will re-run all 79 migrations.")
            
    except Exception as e:
        print(f"Failed to reset database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    reset_db()

