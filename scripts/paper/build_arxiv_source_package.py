#!/usr/bin/env python3
"""Build a local arXiv source archive for the emotional-residue preprint.

This is a packaging helper only. It never uploads anything. The archive is
strictly allowlisted so experiment data, logs, annotations, and transcripts do
not accidentally enter the arXiv source bundle.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTDIR = REPO_ROOT / "docs/paper/results/arxiv-source"
ARCHIVE_NAME = "emotional-residue-arxiv-source.tar.gz"
MANIFEST_NAME = "manifest.json"


@dataclass(frozen=True)
class PackageFile:
    source: Path
    archive_name: str


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def package_files(root: Path, include_readme: bool = False) -> list[PackageFile]:
    files = [PackageFile(root / "docs/paper/arxiv/main.tex", "main.tex")]
    if include_readme:
        files.append(PackageFile(root / "docs/paper/arxiv/README.md", "README.md"))
    return files


def validate_sources(files: list[PackageFile]) -> None:
    forbidden_archive_names = {
        "dataset.json",
        "annotation_sheet.csv",
        "annotation_key.csv",
        "transcripts.md",
    }
    for item in files:
        if not item.source.exists():
            raise FileNotFoundError(f"Missing source file: {item.source}")
        if item.source.name in forbidden_archive_names:
            raise ValueError(f"Forbidden source file in package allowlist: {item.source}")
        if "results" in item.source.parts or "data" in item.source.parts:
            raise ValueError(f"Package source must not come from data/results: {item.source}")
        if item.archive_name.startswith("/") or ".." in Path(item.archive_name).parts:
            raise ValueError(f"Unsafe archive path: {item.archive_name}")


def build_archive(root: Path, outdir: Path, include_readme: bool = False) -> tuple[Path, Path, dict]:
    files = package_files(root, include_readme=include_readme)
    validate_sources(files)

    outdir.mkdir(parents=True, exist_ok=True)
    archive_path = outdir / ARCHIVE_NAME
    manifest_path = outdir / MANIFEST_NAME

    archive_buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=archive_buffer, mode="wb", mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode="w") as tar:
            for item in files:
                data = item.source.read_bytes()
                info = tarfile.TarInfo(item.archive_name)
                info.size = len(data)
                info.mtime = 0
                info.mode = 0o644
                tar.addfile(info, io.BytesIO(data))

    archive_bytes = archive_buffer.getvalue()
    archive_tmp = archive_path.with_name(f".{archive_path.name}.{os.getpid()}.tmp")
    archive_tmp.write_bytes(archive_bytes)
    archive_tmp.replace(archive_path)

    manifest = {
        "archive": archive_path.name,
        "archive_sha256": sha256_bytes(archive_bytes),
        "policy": "allowlisted local source package; no upload performed",
        "files": [
            {
                "archive_name": item.archive_name,
                "source": str(item.source.relative_to(root)),
                "sha256": sha256_file(item.source),
            }
            for item in files
        ],
        "excluded_by_design": [
            "experiment datasets",
            "ablation logs",
            "annotation sheets",
            "annotation keys",
            "blinded transcript packets",
            "generated figures/results",
        ],
    }
    manifest_tmp = manifest_path.with_name(f".{manifest_path.name}.{os.getpid()}.tmp")
    manifest_tmp.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest_tmp.replace(manifest_path)
    return archive_path, manifest_path, manifest


def inspect_archive(path: Path) -> list[str]:
    with tarfile.open(path, mode="r:gz") as tar:
        return sorted(member.name for member in tar.getmembers())


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        arxiv = root / "docs/paper/arxiv"
        arxiv.mkdir(parents=True)
        (arxiv / "main.tex").write_text(
            "\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}\n",
            encoding="utf-8",
        )
        (arxiv / "README.md").write_text("# package\n", encoding="utf-8")
        outdir = root / "out"
        archive_path, manifest_path, manifest = build_archive(root, outdir)
        assert archive_path.exists()
        assert manifest_path.exists()
        assert inspect_archive(archive_path) == ["main.tex"]
        assert manifest["files"][0]["archive_name"] == "main.tex"

        archive_path2, _, manifest2 = build_archive(root, outdir)
        assert archive_path.read_bytes() == archive_path2.read_bytes()
        assert manifest["archive_sha256"] == manifest2["archive_sha256"]

        archive_path, _, _ = build_archive(root, outdir, include_readme=True)
        assert inspect_archive(archive_path) == ["README.md", "main.tex"]
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--outdir", type=Path, default=DEFAULT_OUTDIR)
    parser.add_argument("--include-readme", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    archive_path, manifest_path, manifest = build_archive(
        args.root,
        args.outdir,
        include_readme=args.include_readme,
    )
    members = inspect_archive(archive_path)
    print(f"Archive: {archive_path}")
    print(f"Manifest: {manifest_path}")
    print(f"SHA256: {manifest['archive_sha256']}")
    print("Files:")
    for name in members:
        print(f"- {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
