"""Administrator commands for a self-hosted installation.

Usage inside Docker:

    docker compose exec --user interpres interpres python -m app.cli list-users
    docker compose exec --user interpres interpres python -m app.cli reset-password --email you@example.com
"""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import select

from .accounts import find_user_by_email, reset_password
from .database import SessionLocal
from .models import User


def _cmd_reset_password(args: argparse.Namespace) -> int:
    db = SessionLocal()
    try:
        user = find_user_by_email(db, args.email)
        if not user:
            print(f"Nenhuma conta encontrada para {args.email}.", file=sys.stderr)
            return 1

        password = getpass.getpass("Nova senha (mínimo 10 caracteres): ")
        confirm = getpass.getpass("Confirme a nova senha: ")
        if len(password) < 10:
            print("A senha precisa ter pelo menos 10 caracteres.", file=sys.stderr)
            return 2
        if password != confirm:
            print("As duas senhas não são iguais.", file=sys.stderr)
            return 2

        updated, code = reset_password(db, args.email, password)
        if not updated or not code:
            print("Não foi possível redefinir a senha.", file=sys.stderr)
            return 1

        print(f"Senha redefinida para {updated.email}.")
        print(f"Novo código de recuperação: {code}")
        print("Guarde este código: ele não será mostrado novamente.")
        print("Todas as sessões antigas foram encerradas.")
        return 0
    finally:
        db.close()


def _cmd_list_users(_: argparse.Namespace) -> int:
    db = SessionLocal()
    try:
        users = db.scalars(select(User).order_by(User.created_at)).all()
        if not users:
            print("Nenhuma conta criada ainda.")
            return 0
        for user in users:
            print(f"{user.email}\tcriada em {user.created_at.isoformat()}")
        return 0
    finally:
        db.close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="interpres")
    subparsers = parser.add_subparsers(dest="command", required=True)

    reset = subparsers.add_parser(
        "reset-password",
        help="Redefine a senha do dono e gera um novo código de recuperação.",
    )
    reset.add_argument("--email", required=True, help="E-mail da conta de dono.")
    reset.set_defaults(func=_cmd_reset_password)

    listing = subparsers.add_parser("list-users", help="Lista as contas da instalação.")
    listing.set_defaults(func=_cmd_list_users)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
