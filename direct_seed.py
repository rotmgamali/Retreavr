import asyncio
import os
from pathlib import Path
import asyncpg
from dotenv import load_dotenv

# Extract DB URL from .env
def get_db_url():
    env_path = Path("backend/.env")
    with open(env_path) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
                return url.replace("postgresql+asyncpg://", "postgresql://")
    return None

async def run_seed():
    db_url = get_db_url()
    if not db_url:
        print("COULD NOT FIND DATABASE_URL")
        return
        
    seeder_path = "seeder.sql"
    with open(seeder_path, "r") as f:
        sql_content = f.read()
    
    # asyncpg.connect supports multiple commands in one execute()
    conn = await asyncpg.connect(db_url)
    try:
        await conn.execute(sql_content)
        print("Database seeding SUCCESSFUL.")
    except Exception as e:
        print(f"FAILED: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_seed())
