import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path.cwd()))
from sqlalchemy import select
from app.core.database import async_session
from app.models.user import User

async def list_v():
    try:
        async with async_session() as s:
            result = await s.execute(select(User).order_by(User.created_at.desc()))
            users = result.scalars().all()
            for u in users:
                print(f"User: {u.email}, Role: {u.role}, Created: {u.created_at}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_v())
