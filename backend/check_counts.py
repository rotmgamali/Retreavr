import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path.cwd()))
from sqlalchemy import text
from app.core.database import async_session

async def check():
    try:
        async with async_session() as s:
            res = await s.execute(text("SELECT count(*) FROM organizations"))
            count = res.scalar()
            print(f"Organizations count: {count}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
