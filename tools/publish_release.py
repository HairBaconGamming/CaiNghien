from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from cainghien import __version__


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def file_entry(version: str, kind: str, source: Path, target_name: str) -> dict:
    return {
        "url": f"../downloads/{version}/{target_name}",
        "size_bytes": source.stat().st_size,
        "sha256": hash_file(source),
    }


def upsert_release(data: dict, version: str, release: dict) -> None:
    releases = [item for item in data.get("releases", []) if item.get("version") != version]
    releases.insert(0, release)
    data["releases"] = releases
    data["latest"] = release


def prune_old_entries(folder: Path, *, keep: int) -> None:
    if not folder.exists():
        return
    items = sorted(folder.iterdir(), key=lambda item: item.stat().st_mtime, reverse=True)
    for item in items[keep:]:
        if item.is_dir():
            shutil.rmtree(item, ignore_errors=True)
        else:
            try:
                item.unlink()
            except OSError:
                pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--portable", required=True)
    parser.add_argument("--installer", required=True)
    parser.add_argument("--keep-builds", type=int, default=5)
    args = parser.parse_args()

    root = ROOT
    portable_path = Path(args.portable).resolve()
    installer_path = Path(args.installer).resolve()
    web_root = root / "web"
    downloads_dir = web_root / "downloads" / __version__
    data_dir = web_root / "data"
    assets_dir = web_root / "assets"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    portable_name = f"CaiNghienFocusGuard-{__version__}.exe"
    installer_name = f"CaiNghienFocusGuard-Setup-{__version__}.exe"
    portable_target = downloads_dir / portable_name
    installer_target = downloads_dir / installer_name
    shutil.copy2(portable_path, portable_target)
    shutil.copy2(installer_path, installer_target)

    preview_asset = root / "assets" / "CaiNghienFocusGuard-preview.png"
    if preview_asset.exists():
        shutil.copy2(preview_asset, assets_dir / preview_asset.name)

    releases_path = data_dir / "releases.json"
    manifest_path = data_dir / "update-manifest.json"
    published_at = datetime.now().strftime("%Y-%m-%d")

    releases_data = load_json(
        releases_path,
        {"latest": {}, "releases": []},
    )
    existing_notes = []
    for item in releases_data.get("releases", []):
        if item.get("version") == __version__:
            existing_notes = [str(note) for note in item.get("notes", [])]
            break
    if not existing_notes:
        existing_notes = [
            "Them web release hub va updater co hoi y kien.",
            "Them cleanup cache ban cap nhat cu.",
        ]

    release = {
        "version": __version__,
        "published_at": published_at,
        "notes": existing_notes,
        "files": {
            "installer": file_entry(__version__, "installer", installer_target, installer_name),
            "portable": file_entry(__version__, "portable", portable_target, portable_name),
        },
    }
    upsert_release(releases_data, __version__, release)
    releases_path.write_text(
        json.dumps(releases_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    update_manifest = {
        "product": "CaiNghien Focus Guard",
        "latest": {
            "version": __version__,
            "published_at": published_at,
            "installer": release["files"]["installer"]["url"],
            "notes": existing_notes,
            "sha256": release["files"]["installer"]["sha256"],
            "size_bytes": release["files"]["installer"]["size_bytes"],
        },
    }
    manifest_path.write_text(
        json.dumps(update_manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    prune_old_entries(root / ".release_dist", keep=args.keep_builds)
    prune_old_entries(root / ".release_work", keep=args.keep_builds)
    prune_old_entries(root / "dist" / "installer", keep=args.keep_builds)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
