"""SMS sending via Twilio."""
import logging

from twilio.rest import Client as TwilioClient

logger = logging.getLogger(__name__)


async def send_sms(
    to_number: str,
    from_number: str,
    body: str,
    twilio_client: TwilioClient,
) -> dict:
    """Send an SMS via Twilio."""
    try:
        message = twilio_client.messages.create(
            body=body,
            from_=from_number,
            to=to_number,
        )
        return {"status": "sent", "sid": message.sid}
    except Exception as e:
        logger.error("Twilio SMS error: %s", str(e))
        raise
