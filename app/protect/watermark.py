"""
Invisible watermarking using DWT-DCT-SVD via the invisible-watermark library.
Embeds a 256-bit SHA-256 hash of the payload (user_id:artwork_id:timestamp).
The hash is stored in the DB alongside the artwork for lookup during verification.
"""
import hashlib
from datetime import datetime, timezone

import cv2
import numpy as np
from imwatermark import WatermarkEncoder, WatermarkDecoder
from PIL import Image

WATERMARK_BITS = 256  # SHA-256


def _payload_to_hash(payload_str):
    """Convert a payload string to a SHA-256 hash, returned as hex and bits."""
    hash_bytes = hashlib.sha256(payload_str.encode('utf-8')).digest()
    hex_str = hash_bytes.hex()
    bits = []
    for b in hash_bytes:
        for i in range(8):
            bits.append((b >> (7 - i)) & 1)
    return hex_str, bits


def _bits_to_hex(bits):
    """Convert a list of bits back to a hex string."""
    byte_list = []
    for i in range(0, len(bits), 8):
        byte_val = 0
        for j in range(8):
            if i + j < len(bits):
                byte_val = (byte_val << 1) | int(bits[i + j])
            else:
                byte_val = byte_val << 1
        byte_list.append(byte_val)
    return bytes(byte_list).hex()


def build_payload(user_id, artwork_id, timestamp=None):
    """Build the watermark payload string and its hash."""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).isoformat()
    payload = f'{user_id}:{artwork_id}:{timestamp}'
    hex_hash, _ = _payload_to_hash(payload)
    return payload, hex_hash


def encode_watermark(image_path, output_path, user_id, artwork_id, timestamp=None):
    """
    Apply invisible DWT-DCT-SVD watermark to an image.

    Returns (payload_string, hash_hex) — the hash should be stored in the DB.
    """
    payload, hex_hash = build_payload(user_id, artwork_id, timestamp)
    _, bits = _payload_to_hash(payload)

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f'Could not read image: {image_path}')

    encoder = WatermarkEncoder()
    encoder.set_watermark('bits', bits)
    encoded_img = encoder.encode(img, 'dwtDctSvd')

    cv2.imwrite(output_path, encoded_img)
    return payload, hex_hash


def decode_watermark(image_path):
    """
    Extract invisible watermark hash from an image.

    Returns the extracted hex hash string, or None if extraction fails.
    """
    img = cv2.imread(image_path)
    if img is None:
        return None

    decoder = WatermarkDecoder('bits', WATERMARK_BITS)
    try:
        extracted_bits = decoder.decode(img, 'dwtDctSvd')
    except Exception:
        return None

    extracted_hex = _bits_to_hex(extracted_bits)
    return extracted_hex


def compare_hashes(extracted_hex, stored_hex):
    """
    Compare extracted hash with stored hash.
    Returns certainty percentage (100 = exact match, 0 = no match).
    """
    if not extracted_hex or not stored_hex:
        return 0

    # Compare bit by bit
    matching_bits = 0
    total_bits = WATERMARK_BITS

    ext_bytes = bytes.fromhex(extracted_hex)
    stored_bytes = bytes.fromhex(stored_hex)

    for i in range(min(len(ext_bytes), len(stored_bytes))):
        xor = ext_bytes[i] ^ stored_bytes[i]
        # Count matching bits (8 - popcount of XOR)
        matching_bits += 8 - bin(xor).count('1')

    return int((matching_bits / total_bits) * 100)


def apply_visible_watermark(image_path, logo_path, output_path,
                            x_pct=0.02, y_pct=0.92, size_pct=0.06, opacity=0.4):
    """
    Stamp the visible futtlecish logo on an image.

    x_pct, y_pct: position as percentage of image dimensions (0-1)
    size_pct: logo width as percentage of image width
    opacity: 0-1 transparency
    """
    img = Image.open(image_path).convert('RGBA')
    logo = Image.open(logo_path).convert('RGBA')

    logo_width = int(img.width * size_pct)
    logo_height = int(logo_width * (logo.height / logo.width))
    logo = logo.resize((logo_width, logo_height), Image.LANCZOS)

    alpha = logo.split()[3]
    alpha = alpha.point(lambda p: int(p * opacity))
    logo.putalpha(alpha)

    x = int(img.width * x_pct)
    y = int(img.height * y_pct)
    x = max(0, min(x, img.width - logo_width))
    y = max(0, min(y, img.height - logo_height))

    img.paste(logo, (x, y), logo)

    output_img = img.convert('RGB')
    output_img.save(output_path, quality=95)
