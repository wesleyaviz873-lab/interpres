"""Optional TOTP second factor and backup codes."""

from __future__ import annotations

import base64
import hmac
import io
import json

import pyotp
import qrcode

from .crypto import decrypt_secret, hash_backup_code
from .models import User
from .security import new_backup_code


def new_totp_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(email: str, secret: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Interpres")


def qr_data_url(uri: str) -> str:
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def verify_totp(user: User, code: str) -> bool:
    if not user.totp_secret or not code:
        return False
    try:
        secret = decrypt_secret(user.totp_secret)
    except Exception:
        return False
    return bool(pyotp.TOTP(secret).verify(code.strip(), valid_window=1))


def verify_backup_code(user: User, code: str) -> bool:
    if not user.totp_backup_codes or not code:
        return False
    try:
        stored = json.loads(user.totp_backup_codes)
    except (TypeError, ValueError):
        return False
    digest = hash_backup_code(code)
    for index, candidate in enumerate(stored):
        if isinstance(candidate, str) and hmac.compare_digest(candidate, digest):
            stored.pop(index)
            user.totp_backup_codes = json.dumps(stored)
            return True
    return False


def verify_second_factor(user: User, code: str) -> bool:
    return verify_totp(user, code) or verify_backup_code(user, code)


def generate_backup_codes(count: int = 8) -> list[str]:
    return [new_backup_code() for _ in range(count)]


def set_backup_codes(user: User, codes: list[str]) -> None:
    user.totp_backup_codes = json.dumps([hash_backup_code(code) for code in codes])


def backup_codes_remaining(user: User) -> int:
    if not user.totp_backup_codes:
        return 0
    try:
        codes = json.loads(user.totp_backup_codes)
    except (TypeError, ValueError):
        return 0
    return len(codes) if isinstance(codes, list) else 0
