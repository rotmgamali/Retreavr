import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path.cwd()))
from sqlalchemy import text
from app.core.database import async_session

async def run():
    async with async_session() as s:
        try:
            res = await s.execute(text("SELECT id, organization_id, role FROM users LIMIT 1"))
            row = res.fetchone()
            if row:
                print(f"USER_ID={row[0]}")
                print(f"ORG_ID={row[1]}")
                print(f"ROLE={row[2]}")
            else:
                print("EMPTY_USERS")
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(run())
