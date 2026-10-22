"""Optional SMTP delivery for password recovery.

SMTP is deliberately optional. A self-hosted installation without a mail
provider still has the one-time recovery code and the admin CLI.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from .config import settings


def send_password_reset_code(to_email: str, code: str) -> None:
    if not settings.smtp_configured:
        raise RuntimeError("SMTP não configurado.")

    message = EmailMessage()
    message["Subject"] = "Interpres: código para redefinir sua senha"
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                "Olá,",
                "",
                "Recebemos um pedido para redefinir a senha da sua conta no Interpres.",
                "",
                f"Seu código é: {code}",
                "",
                "Ele expira em 15 minutos e só pode ser usado uma vez.",
                "Se você não pediu isso, ignore esta mensagem.",
                "",
                "Interpres",
            ]
        )
    )

    security = settings.smtp_security.strip().lower()
    if security == "ssl":
        client: smtplib.SMTP = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)
    else:
        client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)

    with client as server:
        if security == "starttls":
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)

def send_login_code(to_email: str, code: str) -> None:
    if not settings.smtp_configured:
        raise RuntimeError("SMTP não configurado.")

    message = EmailMessage()
    message["Subject"] = "Interpres: código de acesso"
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                "Olá,",
                "",
                f"Seu código de acesso ao Interpres é: {code}",
                "",
                "Ele expira em 15 minutos e só pode ser usado uma vez.",
                "Se você não pediu isso, ignore esta mensagem.",
                "",
                "Interpres",
            ]
        )
    )

    security = settings.smtp_security.strip().lower()
    if security == "ssl":
        client: smtplib.SMTP = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)
    else:
        client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)

    with client as server:
        if security == "starttls":
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)

