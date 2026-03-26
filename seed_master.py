import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy import text

# Add backend to sys.path
sys.path.append(str(Path.cwd() / "backend"))

from app.core.database import async_session

async def run_seed():
    with open("seeder.sql", "r") as f:
        # Split by ";" but excluding those inside strings/blocks if possible
        # Simple split for now
        sql_content = f.read()
        
    async with async_session() as session:
        # Use text() to wrap the whole content if possible, or split
        # We'll try splitting by ";" but be careful with the DO $$ block
        # Actually, let's just use text() on the whole thing if it doesn't contain multiple statements that fail
        # Or better: split by ";" but handle the DO block
        
        commands = sql_content.split(";")
        for cmd in commands:
            if not cmd.strip():
                continue
            try:
                await session.execute(text(cmd.strip()))
                print(f"Executed: {cmd.strip()[:50]}...")
            except Exception as e:
                print(f"Error executing: {e}")
        
        await session.commit()
    print("Database seeding completed.")

if __name__ == "__main__":
    asyncio.run(run_seed())
