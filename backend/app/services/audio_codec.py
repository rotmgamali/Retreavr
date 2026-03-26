"""
Pure-Python audio codec utilities (no audioop dependency).

Provides µ-law ↔ PCM-16 conversion and linear-interpolation resampling using
only the ``struct`` module from the standard library.  This replaces the
deprecated/removed ``audioop`` module (removed in Python 3.13).
"""

import struct

# ---------------------------------------------------------------------------
# µ-law constants
# ---------------------------------------------------------------------------

_MULAW_BIAS = 0x84  # 132
_MULAW_CLIP = 32635

# Pre-computed decode table: µ-law byte → signed 16-bit PCM sample.
# Built once at import time for speed.
_MULAW_DECODE_TABLE: list[int] = []

def _build_decode_table() -> list[int]:
    """Construct the 256-entry µ-law → linear decode table."""
    table: list[int] = []
    for idx in range(256):
        val = ~idx  # bit-invert
        sign = val & 0x80
        exponent = (val >> 4) & 0x07
        mantissa = val & 0x0F
        sample = ((mantissa << 3) + _MULAW_BIAS) << exponent
        sample -= _MULAW_BIAS
        if sign:
            sample = -sample
        # Clamp to 16-bit signed range
        sample = max(-32768, min(32767, sample))
        table.append(sample)
    return table

_MULAW_DECODE_TABLE = _build_decode_table()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def mulaw_decode(data: bytes) -> bytes:
    """Decode µ-law encoded audio to 16-bit signed little-endian PCM.

    Each input byte produces one 16-bit (2-byte) PCM sample.
    """
    samples = [_MULAW_DECODE_TABLE[b] for b in data]
    return struct.pack(f"<{len(samples)}h", *samples)


def mulaw_encode(data: bytes) -> bytes:
    """Encode 16-bit signed little-endian PCM audio to µ-law.

    Every two input bytes (one 16-bit sample) produce one µ-law byte.
    """
    n_samples = len(data) // 2
    samples = struct.unpack(f"<{n_samples}h", data)
    out = bytearray(n_samples)
    for i, sample in enumerate(samples):
        sign = 0
        if sample < 0:
            sign = 0x80
            sample = -sample
        if sample > _MULAW_CLIP:
            sample = _MULAW_CLIP
        sample += _MULAW_BIAS

        exponent = 7
        mask = 0x4000
        while exponent > 0 and not (sample & mask):
            exponent -= 1
            mask >>= 1

        mantissa = (sample >> (exponent + 3)) & 0x0F
        mulaw_byte = ~(sign | (exponent << 4) | mantissa) & 0xFF
        out[i] = mulaw_byte
    return bytes(out)


def resample_linear(data: bytes, from_rate: int, to_rate: int) -> bytes:
    """Resample 16-bit signed little-endian PCM using linear interpolation.

    Parameters
    ----------
    data : bytes
        Input PCM audio (16-bit LE signed).
    from_rate : int
        Source sample rate in Hz.
    to_rate : int
        Target sample rate in Hz.

    Returns
    -------
    bytes
        Resampled PCM audio (16-bit LE signed).
    """
    if from_rate == to_rate:
        return data

    n_in = len(data) // 2
    if n_in == 0:
        return b""

    samples_in = struct.unpack(f"<{n_in}h", data)

    ratio = from_rate / to_rate
    n_out = int(n_in / ratio)
    samples_out: list[int] = []

    for i in range(n_out):
        src_pos = i * ratio
        idx = int(src_pos)
        frac = src_pos - idx
        if idx + 1 < n_in:
            value = samples_in[idx] * (1.0 - frac) + samples_in[idx + 1] * frac
        else:
            value = float(samples_in[min(idx, n_in - 1)])
        # Clamp to 16-bit signed range
        value = max(-32768.0, min(32767.0, value))
        samples_out.append(int(value))

    return struct.pack(f"<{len(samples_out)}h", *samples_out)
