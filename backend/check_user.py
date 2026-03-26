import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path.cwd()))
from sqlalchemy import select
from app.core.database import async_session
from app.models.user import User

async def check():
    try:
        async with async_session() as s:
            result = await s.execute(select(User).where(User.email == 'admin@retrevr.io'))
            u = result.scalar_one_or_none()
            if u:
                print(f"User found: {u.email}")
                print(f"Hash in DB: {u.hashed_password}")
            else:
                print("User NOT found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
