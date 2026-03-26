import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path.cwd()))
from sqlalchemy import text
from app.core.database import async_session

async def check():
    try:
        async with async_session() as s:
            # Query information_schema
            res = await s.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            """))
            cols = [r[0] for r in res.fetchall()]
            print(f"Columns in public.users: {cols}")
            
            res = await s.execute(text("SELECT current_schema()"))
            print(f"Current schema: {res.scalar()}")
            
            res = await s.execute(text("SHOW search_path"))
            print(f"Search path: {res.scalar()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
