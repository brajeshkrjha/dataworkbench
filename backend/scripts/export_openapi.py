"""Export the FastAPI OpenAPI schema to a JSON file.

The generated file is consumed by the frontend's `generate:api-types`
npm script (openapi-typescript) so TypeScript types are derived from
the backend contract instead of being hand-duplicated.

Run from backend/: python -m scripts.export_openapi [--check]
"""
import argparse
import json
import sys
from pathlib import Path

from app.main import app

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the snapshot without rewriting it")
    args = parser.parse_args(argv)
    schema = app.openapi()

    if args.check:
        try:
            current = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            print(f"Cannot read OpenAPI snapshot: {exc}", file=sys.stderr)
            return 1
        if current != schema:
            print("OpenAPI snapshot is out of date; run python -m scripts.export_openapi.", file=sys.stderr)
            return 1
        print("OpenAPI snapshot is up to date.")
        return 0

    OUTPUT_PATH.write_text(json.dumps(schema, indent=2), encoding="utf-8")
    print(f"Wrote OpenAPI schema to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
