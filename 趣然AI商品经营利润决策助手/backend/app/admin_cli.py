from __future__ import annotations

import argparse

from sqlalchemy import select

from app.db import SessionLocal
from app.models import RoleMapping, utc_now
from app.services.auth import VALID_ROLES


def main() -> None:
    parser = argparse.ArgumentParser(description="维护 IT 批准的钉钉身份业务角色映射")
    parser.add_argument("actor_ref")
    parser.add_argument("actor_name")
    parser.add_argument("role", choices=sorted(VALID_ROLES))
    args = parser.parse_args()
    with SessionLocal() as db:
        mappings = db.scalars(
            select(RoleMapping).where(RoleMapping.actor_ref == args.actor_ref)
        ).all()
        for mapping in mappings:
            mapping.active = mapping.role == args.role
            mapping.actor_name = args.actor_name
            mapping.updated_at = utc_now()
        selected = next((mapping for mapping in mappings if mapping.role == args.role), None)
        if selected is None:
            db.add(
                RoleMapping(
                    actor_ref=args.actor_ref,
                    actor_name=args.actor_name,
                    role=args.role,
                    active=True,
                )
            )
        db.commit()
    print(f"已更新 {args.actor_ref} -> {args.role}")


if __name__ == "__main__":
    main()
