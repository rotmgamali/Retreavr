"""
Call Recording Pipeline

Captures raw audio during calls, uploads to S3/R2 on completion,
stores metadata in DB, and generates signed S3 URLs for playback.
"""
import logging
import uuid
from typing import Optional

import boto3
import httpx
from botocore.exceptions import ClientError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.calls import Call, CallRecording

logger = logging.getLogger(__name__)
settings = get_settings()


# ---------------------------------------------------------------------------
# S3 / R2 client factory
# ---------------------------------------------------------------------------

def _get_s3_client():
    kwargs = {
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
        "region_name": settings.s3_region,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


def _recording_s3_key(org_id: uuid.UUID, call_id: uuid.UUID) -> str:
    return f"recordings/{org_id}/{call_id}.wav"


# ---------------------------------------------------------------------------
# Upload helpers
# ---------------------------------------------------------------------------

async def upload_recording(
    db: AsyncSession,
    call: Call,
    audio_bytes: bytes,
    duration_seconds: Optional[int] = None,
    content_type: str = "audio/wav",
) -> CallRecording:
    """
    Upload raw audio bytes to S3/R2 and create/update the CallRecording record.
    """
    s3_key = _recording_s3_key(call.organization_id, call.id)
    bucket = settings.s3_bucket_name

    # Upload to S3/R2
    s3 = _get_s3_client()
    s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=audio_bytes,
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )
    logger.info("Uploaded recording: bucket=%s key=%s bytes=%d", bucket, s3_key, len(audio_bytes))

    # Upsert CallRecording row
    result = await db.execute(
        select(CallRecording).where(CallRecording.call_id == call.id)
    )
    recording = result.scalar_one_or_none()

    if recording is None:
        recording = CallRecording(
            call_id=call.id,
            recording_url=None,  # use signed URL generation instead
            duration=duration_seconds,
            file_size=len(audio_bytes),
        )
        db.add(recording)
    else:
        recording.duration = duration_seconds
        recording.file_size = len(audio_bytes)

    await db.flush()
    return recording


async def store_twilio_recording_url(
    db: AsyncSession,
    call: Call,
    twilio_recording_url: str,
    duration_seconds: Optional[int] = None,
) -> CallRecording:
    """
    When using Twilio's built-in recording (not raw audio capture),
    store the Twilio-hosted URL in the DB.
    """
    result = await db.execute(
        select(CallRecording).where(CallRecording.call_id == call.id)
    )
    recording = result.scalar_one_or_none()

    if recording is None:
        recording = CallRecording(
            call_id=call.id,
            recording_url=twilio_recording_url,
            duration=duration_seconds,
        )
        db.add(recording)
    else:
        recording.recording_url = twilio_recording_url
        if duration_seconds is not None:
            recording.duration = duration_seconds

    await db.flush()
    return recording


# ---------------------------------------------------------------------------
# Signed URL generation
# ---------------------------------------------------------------------------

def generate_signed_url(
    org_id: uuid.UUID,
    call_id: uuid.UUID,
    expires_in: int = 900,
) -> str:
    """
    Generate a pre-signed S3 URL for playback.
    `expires_in` is in seconds (default: 15 minutes).
    """
    s3_key = _recording_s3_key(org_id, call_id)
    s3 = _get_s3_client()
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
        ExpiresIn=expires_in,
    )
    return url


async def get_playback_url(
    db: AsyncSession,
    call_id: uuid.UUID,
    org_id: uuid.UUID,
    expires_in: int = 900,
) -> Optional[str]:
    """
    Return a playback URL for the recording.

    Preference order:
    1. If the recording was uploaded to S3/R2 by us → generate a signed URL.
    2. If we only have a Twilio-hosted URL → return that directly.
    3. No recording → return None.
    """
    result = await db.execute(
        select(CallRecording).where(CallRecording.call_id == call_id)
    )
    recording = result.scalar_one_or_none()
    if recording is None:
        return None

    # Check S3 first
    try:
        s3_key = _recording_s3_key(org_id, call_id)
        s3 = _get_s3_client()
        s3.head_object(Bucket=settings.s3_bucket_name, Key=s3_key)
        return generate_signed_url(org_id, call_id, expires_in)
    except ClientError:
        pass

    # Fallback: Twilio URL
    return recording.recording_url


# ---------------------------------------------------------------------------
# Twilio → S3 download & upload
# ---------------------------------------------------------------------------

async def fetch_and_upload_twilio_recording(
    db: AsyncSession,
    call: Call,
    twilio_recording_url: str,
    recording_sid: str,
    duration_seconds: Optional[int] = None,
) -> CallRecording:
    """
    Download a completed recording from Twilio and upload it to S3/R2
    for long-term storage. The Twilio URL is kept as a fallback.
    """
    # Twilio recording URLs end with .json by default; request .wav
    wav_url = twilio_recording_url.rstrip(".json") + ".wav"

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Twilio requires Basic auth for recording downloads
        auth = (settings.twilio_account_sid, settings.twilio_auth_token) if settings.twilio_account_sid else None
        resp = await client.get(wav_url, auth=auth, follow_redirects=True)
        resp.raise_for_status()
        audio_bytes = resp.content

    logger.info(
        "Downloaded Twilio recording %s (%d bytes) for call %s",
        recording_sid, len(audio_bytes), call.id,
    )

    return await upload_recording(
        db=db,
        call=call,
        audio_bytes=audio_bytes,
        duration_seconds=duration_seconds,
        content_type="audio/wav",
    )
