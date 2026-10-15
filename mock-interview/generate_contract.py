"""Generate CONTRACT.md from the Pydantic schemas."""

from pathlib import Path

from scoring.schemas import contract_markdown


if __name__ == "__main__":
    Path(__file__).with_name("CONTRACT.md").write_text(
        contract_markdown(), encoding="utf-8"
    )
