import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path.cwd()))
from sqlalchemy import text
from app.core.database import async_session

async def check():
    try:
        async with async_session() as s:
            for table in ['organizations', 'users', 'calls']:
                res = await s.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}' AND table_schema = 'public'"))
                cols = [r[0] for r in res.fetchall()]
                print(f"Table {table}: {cols}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
