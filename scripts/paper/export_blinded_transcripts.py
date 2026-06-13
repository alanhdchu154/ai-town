#!/usr/bin/env python3
"""Export blinded transcript packets for human annotation.

Input:
- annotation key CSV from `export_annotation_sheet.py`
- one or more soul-triad markdown reports that contain sections like:
  `## conversation-c:123` followed by `- **海**: ...`

Output:
- one combined markdown packet keyed by `blind_id`
- one markdown file per `blind_id`

The packet intentionally omits condition, rolling-callback labels, marker
scores, and case ids. Speaker names remain by default because character
consistency is one of the rating dimensions; use `--redact-speakers` for a
naturalness-only blinded pass.
"""
from __future__ import annotations

import argparse
import csv
import glob
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


SECTION_RE = re.compile(r"^##\s+(conversation-[^\s]+|conversation-c:\d+)\s*$")
MESSAGE_RE = re.compile(r"^-\s+\*\*(.+?)\*\*:\s*(.*)$")


def parse_report(text: str) -> dict[str, list[tuple[str, str]]]:
    sections: dict[str, list[tuple[str, str]]] = {}
    current_id: str | None = None
    for line in text.splitlines():
        section_match = SECTION_RE.match(line.strip())
        if section_match:
            current_id = section_match.group(1)
            sections.setdefault(current_id, [])
            continue
        if current_id is None:
            continue
        if line.startswith("## "):
            current_id = None
            continue
        message_match = MESSAGE_RE.match(line.strip())
        if message_match:
            speaker, text = message_match.groups()
            sections[current_id].append((speaker.strip(), text.strip()))
    return sections


def load_transcripts(report_patterns: list[str]) -> dict[str, list[tuple[str, str]]]:
    report_paths = expand_report_paths(report_patterns)
    transcripts, _ = load_transcripts_with_sources(report_paths)
    return transcripts


def load_transcripts_with_sources(
    report_paths: list[Path],
) -> tuple[dict[str, list[tuple[str, str]]], dict[str, Path]]:
    transcripts: dict[str, list[tuple[str, str]]] = {}
    source_by_case: dict[str, Path] = {}
    for path in report_paths:
        parsed = parse_report(path.read_text(encoding="utf-8"))
        for case_name, messages in parsed.items():
            if not messages:
                continue
            if case_name in transcripts:
                if transcripts[case_name] != messages:
                    raise ValueError(
                        f"case {case_name} appears with conflicting transcript text in "
                        f"{source_by_case[case_name]} and {path}"
                    )
                continue
            transcripts[case_name] = messages
            source_by_case[case_name] = path
    return transcripts, source_by_case


def expand_report_paths(report_patterns: list[str]) -> list[Path]:
    paths: list[Path] = []
    for pattern in report_patterns:
        matches = sorted(glob.glob(pattern, recursive=True))
        paths.extend(Path(path) for path in (matches if matches else [pattern]))
    return [path for path in paths if path.exists()]


def load_key(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def render_transcript(
    blind_id: str,
    messages: list[tuple[str, str]],
    redact_speakers: bool,
) -> str:
    lines = [f"## {blind_id}", ""]
    for idx, (speaker, text) in enumerate(messages, start=1):
        label = f"Speaker {idx}" if redact_speakers else speaker
        lines.append(f"- **{label}**: {text}")
    lines.append("")
    return "\n".join(lines)


def export_packets(
    key_rows: list[dict],
    transcripts: dict[str, list[tuple[str, str]]],
    outdir: Path,
    redact_speakers: bool,
    source_by_case: dict[str, Path] | None = None,
) -> tuple[int, list[str], list[dict[str, str]]]:
    outdir.mkdir(parents=True, exist_ok=True)
    combined = [
        "# Blinded Transcript Packet",
        "",
        "Rater-visible packet. Contains only blind ids and dialogue text.",
        "",
    ]
    missing: list[str] = []
    case_sources: list[dict[str, str]] = []
    written = 0
    for row in key_rows:
        blind_id = row.get("blind_id", "").strip()
        case_name = row.get("case_name", "").strip()
        messages = transcripts.get(case_name)
        if not blind_id or not case_name or not messages:
            missing.append(case_name or blind_id or "<unknown>")
            continue
        rendered = render_transcript(blind_id, messages, redact_speakers)
        (outdir / f"{blind_id}.md").write_text(rendered, encoding="utf-8")
        combined.append(rendered)
        source_path = source_by_case.get(case_name) if source_by_case else None
        case_sources.append(
            {
                "blind_id": blind_id,
                "case_name": case_name,
                "source_report": str(source_path) if source_path else "",
            }
        )
        written += 1
    (outdir / "transcripts.md").write_text("\n".join(combined), encoding="utf-8")
    missing_path = outdir / "missing_transcripts.txt"
    if missing:
        missing_path.write_text("\n".join(missing) + "\n", encoding="utf-8")
    elif missing_path.exists():
        missing_path.unlink()
    return written, missing, case_sources


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(
    *,
    key_path: Path,
    report_paths: list[Path],
    outdir: Path,
    manifest_path: Path,
    written: int,
    missing: list[str],
    case_sources: list[dict[str, str]],
    redact_speakers: bool,
) -> None:
    transcript_files = sorted(outdir.glob("ER-*.md"))
    outputs = [
        {"path": str(path), "sha256": sha256_file(path), "bytes": path.stat().st_size}
        for path in transcript_files
    ]
    aggregate = outdir / "transcripts.md"
    if aggregate.exists():
        outputs.append({"path": str(aggregate), "sha256": sha256_file(aggregate), "bytes": aggregate.stat().st_size})
    manifest = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "kind": "transcript_packet_manifest",
        "blinding_contract": {
            "condition_labels_omitted": True,
            "callback_labels_omitted": True,
            "marker_scores_omitted": True,
            "case_ids_omitted": True,
            "speaker_names_redacted": redact_speakers,
        },
        "key": {
            "path": str(key_path),
            "sha256": sha256_file(key_path),
        },
        "source_reports": [
            {"path": str(path), "sha256": sha256_file(path), "bytes": path.stat().st_size}
            for path in report_paths
        ],
        "output": {
            "outdir": str(outdir),
            "written": written,
            "missing": missing,
            "case_sources": case_sources,
            "files": outputs,
        },
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def selftest() -> int:
    report = """
# Soul Triad Conversation Harness

## conversation-c:1

- **海**: 先把通知關掉。
- **真晝**: 你剛才手很緊。

## conversation-c:2

- **天澤**: 規則先別急著拆。
"""
    parsed = parse_report(report)
    assert parsed["conversation-c:1"] == [("海", "先把通知關掉。"), ("真晝", "你剛才手很緊。")]
    assert parsed["conversation-c:2"] == [("天澤", "規則先別急著拆。")]
    rendered = render_transcript("ER-0001", parsed["conversation-c:1"], redact_speakers=True)
    assert "conversation-c:1" not in rendered
    assert "Speaker 1" in rendered
    assert "海" not in rendered
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        key = root / "annotation_key.csv"
        report_path = root / "report.md"
        outdir = root / "out"
        manifest = root / "transcript_packet_manifest.json"
        key.write_text("blind_id,case_name\nER-0001,conversation-c:1\n", encoding="utf-8")
        report_path.write_text(report, encoding="utf-8")
        transcripts, source_by_case = load_transcripts_with_sources([report_path])
        written, missing, case_sources = export_packets(
            load_key(key),
            transcripts,
            outdir,
            redact_speakers=True,
            source_by_case=source_by_case,
        )
        write_manifest(
            key_path=key,
            report_paths=[report_path],
            outdir=outdir,
            manifest_path=manifest,
            written=written,
            missing=missing,
            case_sources=case_sources,
            redact_speakers=True,
        )
        parsed_manifest = json.loads(manifest.read_text(encoding="utf-8"))
        assert parsed_manifest["output"]["written"] == 1
        assert parsed_manifest["output"]["case_sources"][0]["source_report"] == str(report_path)
        assert parsed_manifest["blinding_contract"]["speaker_names_redacted"] is True
    print("export_blinded_transcripts selftest: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key", help="annotation_key.csv")
    parser.add_argument(
        "--reports",
        nargs="+",
        default=[
            "docs/paper/emotional-residue/results/**/soul-triad.md",
            "evals/conversations/reports/soul-triad-latest.md",
        ],
        help="soul-triad report paths or glob patterns",
    )
    parser.add_argument("--outdir", default="docs/paper/emotional-residue/results/longitudinal/blinded_transcripts")
    parser.add_argument(
        "--manifest",
        help="transcript packet manifest path; defaults to <outdir>/transcript_packet_manifest.json",
    )
    parser.add_argument("--redact-speakers", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        return selftest()
    if not args.key:
        parser.error("--key is required unless --selftest is used")

    key_rows = load_key(Path(args.key))
    report_paths = expand_report_paths(args.reports)
    transcripts, source_by_case = load_transcripts_with_sources(report_paths)
    outdir = Path(args.outdir)
    written, missing, case_sources = export_packets(
        key_rows,
        transcripts,
        outdir,
        redact_speakers=args.redact_speakers,
        source_by_case=source_by_case,
    )
    manifest_path = Path(args.manifest) if args.manifest else outdir / "transcript_packet_manifest.json"
    write_manifest(
        key_path=Path(args.key),
        report_paths=report_paths,
        outdir=outdir,
        manifest_path=manifest_path,
        written=written,
        missing=missing,
        case_sources=case_sources,
        redact_speakers=args.redact_speakers,
    )
    print(f"wrote {written} blinded transcripts -> {args.outdir}")
    print(f"manifest -> {manifest_path}")
    if missing:
        print(f"warning: missing transcripts for {len(missing)} key rows", file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
