import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import get_settings
from app.models.user import Base 

# Import at least one model per file so they are registered with the Base
from app.models.organization import Organization
from app.models.voice_agents import VoiceAgent
from app.models.leads import Lead
from app.models.calls import Call
from app.models.campaigns import Campaign
from app.models.knowledge import KnowledgeDocument
from app.models.refresh_token import RefreshToken

settings = get_settings()

async def create_tables():
    db_url = settings.database_url
    if "asyncpg" not in db_url:
         db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
         
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        try:
             # This will CREATE TABLES ONLY IF THEY DONT EXIST
             await conn.run_sync(Base.metadata.create_all)
             print("SUCCESS")
        except Exception as e:
             print(f"ERROR: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_tables())
