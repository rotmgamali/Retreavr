"""SendGrid email sending service."""
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    from_email: str,
    api_key: str,
    plain_text: Optional[str] = None,
) -> dict:
    """Send an email via SendGrid v3 API."""
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject,
        "content": [],
    }
    if plain_text:
        payload["content"].append({"type": "text/plain", "value": plain_text})
    payload["content"].append({"type": "text/html", "value": html_body})

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    if resp.status_code not in (200, 201, 202):
        logger.error("SendGrid error %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"SendGrid API error: {resp.status_code}")

    return {"status": "sent", "status_code": resp.status_code}
