import asyncio
from sqlalchemy import text
from app.core.database import async_session

async def run_seed():
    seeder_path = "../seeder.sql"
    with open(seeder_path, "r") as f:
        sql_content = f.read()
    
    async with async_session() as session:
        # We'll split carefully to handle the DO $$ block
        # Actually for simplicity I'll wrap the whole thing if possible
        # but SQLAlchemy doesn't always like multiple statements.
        
        # Let's split by double newline as a hint, or just execute the whole thing
        try:
            await session.execute(text(sql_content))
            await session.commit()
            print("Database seeding completed.")
        except Exception as e:
            print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(run_seed())
