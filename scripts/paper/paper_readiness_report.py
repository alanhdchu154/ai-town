#!/usr/bin/env python3
"""Generate a combined readiness report for the emotional-residue paper.

This report is the local source-of-truth for the current claim boundary. It
combines the claim audit, source audit, local arXiv package manifest, and PDF
tool availability without uploading anything or starting new experiments.
"""

from __future__ import annotations

import argparse
import json
import sys
import tarfile
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import build_arxiv_source_package as arxiv_package  # noqa: E402
import paper_annotation_audit  # noqa: E402
import paper_archive_audit  # noqa: E402
import paper_citation_audit  # noqa: E402
import paper_claim_audit  # noqa: E402
import paper_consistency_audit  # noqa: E402
import paper_design_audit  # noqa: E402
import paper_empirical_audit  # noqa: E402
import paper_evidence_matrix_audit  # noqa: E402
import paper_mechanism_audit  # noqa: E402
import paper_pdf_preflight  # noqa: E402
import paper_pdf_verification_audit  # noqa: E402
import paper_protocol_audit  # noqa: E402
import paper_source_audit  # noqa: E402
import paper_submission_audit  # noqa: E402
import paper_trace_overlap_audit  # noqa: E402


DEFAULT_OUT = REPO_ROOT / "docs/paper/results/readiness.md"


@dataclass
class Finding:
    severity: str
    check: str
    detail: str


def add(findings: list[Finding], severity: str, check: str, detail: str) -> None:
    findings.append(Finding(severity, check, detail))


def sha256_file(path: Path) -> str:
    return arxiv_package.sha256_file(path)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_archive(root: Path, archive_path: Path, manifest_path: Path) -> list[Finding]:
    findings: list[Finding] = []
    if not archive_path.exists():
        add(findings, "FAIL", "archive_missing", f"Missing archive: {archive_path}")
        return findings
    if not manifest_path.exists():
        add(findings, "FAIL", "manifest_missing", f"Missing manifest: {manifest_path}")
        return findings

    manifest = read_json(manifest_path)
    actual_archive_sha = sha256_file(archive_path)
    recorded_archive_sha = manifest.get("archive_sha256")
    if actual_archive_sha != recorded_archive_sha:
        add(
            findings,
            "FAIL",
            "archive_sha_mismatch",
            f"Archive SHA mismatch: actual {actual_archive_sha}, manifest {recorded_archive_sha}",
        )

    with tarfile.open(archive_path, mode="r:gz") as tar:
        members = sorted(member.name for member in tar.getmembers())
    manifest_members = sorted(item.get("archive_name") for item in manifest.get("files", []))
    if members != manifest_members:
        add(
            findings,
            "FAIL",
            "archive_manifest_members",
            f"Archive members {members} do not match manifest members {manifest_members}",
        )

    banned_fragments = [
        "dataset",
        "annotation",
        "transcript",
        "results",
        "figure",
        ".csv",
        ".json",
        ".md",
    ]
    leaked = [member for member in members if any(fragment in member.lower() for fragment in banned_fragments)]
    if leaked:
        add(findings, "FAIL", "archive_forbidden_member", f"Forbidden archive members: {', '.join(leaked)}")

    for item in manifest.get("files", []):
        source = root / item["source"]
        if not source.exists():
            add(findings, "FAIL", "manifest_source_missing", f"Manifest source missing: {item['source']}")
            continue
        actual_source_sha = sha256_file(source)
        if actual_source_sha != item.get("sha256"):
            add(
                findings,
                "FAIL",
                "source_sha_mismatch",
                f"Source SHA mismatch for {item['source']}: actual {actual_source_sha}, manifest {item.get('sha256')}",
            )

    if not findings:
        add(findings, "PASS", "archive_package", f"Archive verified with members: {', '.join(members)}")
    return findings


def verdict(findings: Iterable[Finding], claim_verdict: str, source_verdict: str) -> str:
    severities = {finding.severity for finding in findings}
    if "FAIL" in severities or claim_verdict == "FAIL" or source_verdict == "FAIL":
        return "FAIL"
    if claim_verdict == "PASS_CONSERVATIVE_PREPRINT" and source_verdict == "PASS":
        return "LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY"
    if source_verdict == "PASS_WITH_WARNINGS":
        return "LOCAL_SOURCE_READY_WITH_WARNINGS"
    return "PASS"


def render_section(title: str, findings: list[Finding]) -> list[str]:
    lines = [f"## {title}", ""]
    if findings:
        for finding in findings:
            lines.append(f"- **{finding.severity} / {finding.check}**: {finding.detail}")
    else:
        lines.append("- No findings.")
    lines.append("")
    return lines


def generate_report(root: Path, out: Path) -> tuple[str, list[Finding]]:
    claim_findings_raw = paper_claim_audit.audit_package(root)
    claim_verdict = paper_claim_audit.verdict(claim_findings_raw)
    claim_findings = [Finding(f.severity, f.check, f.detail) for f in claim_findings_raw]

    source_findings_raw = paper_source_audit.audit_source(root)
    source_verdict = paper_source_audit.verdict(source_findings_raw)
    source_findings = [Finding(f.severity, f.check, f.detail) for f in source_findings_raw]

    citation_findings_raw = paper_citation_audit.audit_citations(root)
    citation_verdict = paper_citation_audit.verdict(citation_findings_raw)
    citation_findings = [Finding(f.severity, f.check, f.detail) for f in citation_findings_raw]
    citation_report_path = root / "docs/paper/results/citation-audit.md"
    citation_report_path.parent.mkdir(parents=True, exist_ok=True)
    citation_report_path.write_text(paper_citation_audit.render(citation_findings_raw, root), encoding="utf-8")

    consistency_findings_raw = paper_consistency_audit.audit_consistency(root)
    consistency_verdict = paper_consistency_audit.verdict(consistency_findings_raw)
    consistency_findings = [Finding(f.severity, f.check, f.detail) for f in consistency_findings_raw]

    protocol_findings_raw = paper_protocol_audit.audit_protocol(root)
    protocol_verdict = paper_protocol_audit.verdict(protocol_findings_raw)
    protocol_findings = [Finding(f.severity, f.check, f.detail) for f in protocol_findings_raw]

    design_findings_raw = paper_design_audit.audit_design(root)
    design_verdict = paper_design_audit.verdict(design_findings_raw)
    design_findings = [Finding(f.severity, f.check, f.detail) for f in design_findings_raw]
    design_report_path = root / "docs/paper/results/design-audit.md"
    design_report_path.parent.mkdir(parents=True, exist_ok=True)
    design_report_path.write_text(paper_design_audit.render(design_findings_raw, root), encoding="utf-8")

    mechanism_findings_raw = paper_mechanism_audit.audit_mechanism(root)
    mechanism_verdict = paper_mechanism_audit.verdict(mechanism_findings_raw)
    mechanism_findings = [Finding(f.severity, f.check, f.detail) for f in mechanism_findings_raw]

    annotation_findings_raw = paper_annotation_audit.audit_annotations(root)
    annotation_verdict = paper_annotation_audit.verdict(annotation_findings_raw)
    annotation_findings = [Finding(f.severity, f.check, f.detail) for f in annotation_findings_raw]

    empirical_findings_raw = paper_empirical_audit.audit_empirical(root)
    empirical_verdict = paper_empirical_audit.verdict(empirical_findings_raw)
    empirical_findings = [Finding(f.severity, f.check, f.detail) for f in empirical_findings_raw]
    empirical_report_path = root / "docs/paper/results/empirical-audit.md"
    empirical_report_path.parent.mkdir(parents=True, exist_ok=True)
    empirical_report_path.write_text(paper_empirical_audit.render(empirical_findings_raw, root), encoding="utf-8")

    trace_findings_raw, trace_cases = paper_trace_overlap_audit.audit_overlap(root)
    trace_verdict = paper_trace_overlap_audit.verdict(trace_findings_raw)
    trace_findings = [Finding(f.severity, f.check, f.detail) for f in trace_findings_raw]
    trace_report_path = root / "docs/paper/results/trace-overlap-audit.md"
    trace_report_path.parent.mkdir(parents=True, exist_ok=True)
    trace_report_path.write_text(
        paper_trace_overlap_audit.render(trace_findings_raw, trace_cases, root),
        encoding="utf-8",
    )

    matrix_findings_raw = paper_evidence_matrix_audit.audit_matrix(root)
    matrix_verdict = paper_evidence_matrix_audit.verdict(matrix_findings_raw)
    matrix_findings = [Finding(f.severity, f.check, f.detail) for f in matrix_findings_raw]
    matrix_report_path = root / "docs/paper/results/evidence-matrix-audit.md"
    matrix_report_path.parent.mkdir(parents=True, exist_ok=True)
    matrix_report_path.write_text(paper_evidence_matrix_audit.render(matrix_findings_raw, root), encoding="utf-8")

    submission_findings_raw = paper_submission_audit.audit_submission(root)
    submission_verdict = paper_submission_audit.verdict(submission_findings_raw)
    submission_findings = [Finding(f.severity, f.check, f.detail) for f in submission_findings_raw]
    submission_report_path = root / "docs/paper/results/submission-audit.md"
    submission_report_path.parent.mkdir(parents=True, exist_ok=True)
    submission_report_path.write_text(paper_submission_audit.render(submission_findings_raw, root), encoding="utf-8")

    archive_findings_raw = paper_archive_audit.audit_archive(root)
    archive_verdict = paper_archive_audit.verdict(archive_findings_raw)
    archive_findings = [Finding(f.severity, f.check, f.detail) for f in archive_findings_raw]
    archive_report_path = root / "docs/paper/results/archive-audit.md"
    archive_report_path.parent.mkdir(parents=True, exist_ok=True)
    archive_report_path.write_text(paper_archive_audit.render(archive_findings_raw, root), encoding="utf-8")
    archive_path = root / "docs/paper/results/arxiv-source" / arxiv_package.ARCHIVE_NAME
    manifest_path = root / "docs/paper/results/arxiv-source" / arxiv_package.MANIFEST_NAME
    manifest = read_json(manifest_path)
    pdf_findings_raw = paper_pdf_preflight.audit_pdf(root)
    pdf_verdict = paper_pdf_preflight.verdict(pdf_findings_raw)
    pdf_findings = [Finding(f.severity, f.check, f.detail) for f in pdf_findings_raw]
    pdf_report_path = root / "docs/paper/results/pdf-preflight.md"
    pdf_report_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_report_path.write_text(paper_pdf_preflight.render(pdf_findings_raw, root), encoding="utf-8")

    pdf_verification_findings_raw = paper_pdf_verification_audit.audit_pdf_verification(root)
    pdf_verification_verdict = paper_pdf_verification_audit.verdict(pdf_verification_findings_raw)
    pdf_verification_findings = [
        Finding(f.severity, f.check, f.detail) for f in pdf_verification_findings_raw
    ]
    pdf_verification_report_path = root / "docs/paper/results/pdf-verification-audit.md"
    pdf_verification_report_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_verification_report_path.write_text(
        paper_pdf_verification_audit.render(pdf_verification_findings_raw, root),
        encoding="utf-8",
    )

    all_findings = (
        claim_findings
        + source_findings
        + citation_findings
        + consistency_findings
        + protocol_findings
        + design_findings
        + mechanism_findings
        + annotation_findings
        + empirical_findings
        + trace_findings
        + matrix_findings
        + submission_findings
        + archive_findings
        + pdf_findings
        + pdf_verification_findings
    )
    result = verdict(all_findings, claim_verdict, source_verdict)
    counts = Counter(f.severity for f in all_findings)

    lines = [
        "# Emotional-Residue Paper Readiness",
        "",
        f"Repository: `{root}`",
        f"Verdict: **{result}**",
        "",
        "## Summary",
        "",
        f"- Claim audit: `{claim_verdict}`",
        f"- Source audit: `{source_verdict}`",
        f"- Citation provenance audit: `{citation_verdict}`",
        f"- Consistency audit: `{consistency_verdict}`",
        f"- Protocol audit: `{protocol_verdict}`",
        f"- Causal design audit: `{design_verdict}`",
        f"- Mechanism audit: `{mechanism_verdict}`",
        f"- Annotation audit: `{annotation_verdict}`",
        f"- Empirical ablation audit: `{empirical_verdict}`",
        f"- Trace-overlap audit: `{trace_verdict}`",
        f"- Evidence matrix audit: `{matrix_verdict}`",
        f"- Submission decision audit: `{submission_verdict}`",
        f"- Archive package audit: `{archive_verdict}`",
        f"- PDF preflight: `{pdf_verdict}`",
        f"- PDF verification audit: `{pdf_verification_verdict}`",
        f"- arXiv source archive: `{archive_path.relative_to(root)}`",
        f"- arXiv source SHA-256: `{manifest['archive_sha256']}`",
        "- External upload/submission: not performed by this report",
        "",
        "## Severity Counts",
        "",
    ]
    for severity in ["FAIL", "EMPIRICAL_BLOCKER", "EXTERNAL_BLOCKER", "PDF_BLOCKER", "WARN", "INFO", "PASS"]:
        lines.append(f"- {severity}: {counts.get(severity, 0)}")
    lines.append("")

    lines.extend(render_section("Claim Boundary", claim_findings))
    lines.extend(render_section("Source Hygiene", source_findings))
    lines.extend(render_section("Citation Provenance", citation_findings))
    lines.extend(render_section("Manuscript / Artifact Consistency", consistency_findings))
    lines.extend(render_section("Experiment Protocol / Collection Gate", protocol_findings))
    lines.extend(render_section("Causal / Mechanism Design", design_findings))
    lines.extend(render_section("Residue Mechanism / Code Alignment", mechanism_findings))
    lines.extend(render_section("Human Annotation Packet", annotation_findings))
    lines.extend(render_section("Empirical Ablation Dataset", empirical_findings))
    lines.extend(render_section("Trace-to-Dialogue Overlap", trace_findings))
    lines.extend(render_section("Claim-Evidence Matrix", matrix_findings))
    lines.extend(render_section("Submission Decisions", submission_findings))
    lines.extend(render_section("Source Archive", archive_findings))
    lines.extend(render_section("PDF Preflight", pdf_findings))
    lines.extend(render_section("PDF / Platform Verification", pdf_verification_findings))
    lines.extend(
        [
            "## Interpretation",
            "",
            "- `LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY` means the local TeX source, claim boundary, and allowlisted source archive are ready for a conservative design/systems preprint.",
            "- It does not mean the empirical ablation, human annotation validation, rendered PDF, platform preview, or Alan submitter decisions are complete.",
            "- `EMPIRICAL_BLOCKER` findings must be cleared before claiming a completed causal ablation, metric validation, or player-experience result.",
            "- `EXTERNAL_BLOCKER` and `PDF_BLOCKER` findings must be cleared before any actual external posting.",
            "",
        ]
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    report = "\n".join(lines)
    out.write_text(report, encoding="utf-8")
    return result, all_findings


def write_minimal_claim_inputs(root: Path) -> None:
    (root / "docs/paper/arxiv").mkdir(parents=True)
    (root / "docs/paper/results/longitudinal/results").mkdir(parents=True)
    (root / "docs/paper/results/longitudinal/blinded_transcripts").mkdir(parents=True)
    (root / "docs/paper/results/current-smoke/results").mkdir(parents=True)
    (root / "docs/paper/results/repeatability").mkdir(parents=True)
    (root / "docs/paper/results/power").mkdir(parents=True)
    (root / "scripts/paper").mkdir(parents=True)
    (root / "docs/paper/arxiv/main.tex").write_text(
        r"""\documentclass{article}
\begin{document}
This is not a controlled player study. There is no completed causal ablation.
No IRB or human-subjects approval is claimed. No external participants were recruited or recorded.
Raw player-conversation transcripts are intentionally excluded.
The metric is rule-based and future work remains. Current pilot data are not enough for an effect claim.
Current datasets do not yet store per-conversation provider/model metadata.
The mechanism claim is narrowed to read-block-suppression.
We report preliminary smoke evidence from the live system: a deterministic rule-based soul-triad evaluation over 8 recent conversations, a rolling two-hour continuity report from June 5, 2026 showing 15 source residue candidates and 2 later callbacks.
On a regenerated report for June 5, 2026, the system selected a 14:00--16:00 source window and a 16:00--18:00 callback window. The report found 3 source conversations, 2 callback conversations, 15 source residue candidates, and 2 rolling callbacks.
Table \ref{tab:markers} reports a smoke snapshot over 8 recent soul-triad conversations.
\begin{table}
\caption{A}
\label{tab:a}
\label{tab:markers}
\begin{tabular}{lrrr}
Emotional expression uniqueness & 0.875 & 0.781 & 0.969 \\
Comfort style uniqueness & 0.688 & 0.562 & 0.875 \\
Burden response uniqueness & 0.688 & 0.562 & 0.875 \\
Rule-based aftertaste proxy & 0.876 & 0.752 & 0.959 \\
Echo similarity penalty & 0.044 & 0.014 & 0.078 \\
Stage-direction leak penalty & 0.000 & 0.000 & 0.000 \\
\end{tabular}
\begin{tabular}{llllrrr}
2026-06-04 & WARN & sample\_pending & 18--20 / 20--22 & 25 & 4 & 6 \\
2026-06-05 & PASS & continuity\_observed & 14--16 / 16--18 & 22 & 15 & 2 \\
2026-06-06 & WARN & sample\_pending & none / none & 2 & 0 & 0 \\
\end{tabular}
\end{table}
Two archived-only sanity blocks then produced two qualifying conversations per arm.
All four records came from the same dyad, and the current aftertaste scores are saturated in both arms.
The paper reports two inclusion-criteria-passing records per arm.
See Table \ref{tab:a} and \cite{x}.
author details to confirm before submission
\begin{thebibliography}{9}\bibitem{x} X.\end{thebibliography}
\end{document}
""",
        encoding="utf-8",
    )
    (root / "docs/paper/arxiv/README.md").write_text(
        "single-file LaTeX source\n"
        "no completed causal ablation or player study\n"
        "PDF compilation must be verified\n"
        "Confirm upstream AI Town license attribution\n",
        encoding="utf-8",
    )
    (root / "docs/paper/PUBLISH_READY_CHECKLIST.md").write_text(
        "not ready to claim a completed controlled ablation\n"
        "Recruit at least one additional blind rater\nPDF compilation\n",
        encoding="utf-8",
    )
    paper_citation_audit.write_fixture(root)
    design_text = (
        "arm-pure full-day / long-window collection\n"
        "rolling_callback_rate\n"
        "callback-window denominator\n"
        "No optional stopping based on p-values\n"
        "Pre-register final N before looking at the main-phase effect estimate.\n"
        "cluster-aware analysis\n"
        "length-matched placebo\n"
        "narrowed mechanism claim\n"
        "read-off alone isolates residue content from prompt length or prompt shape\n"
        "run-level `generation_metadata`\n"
        "trace-to-dialogue overlap\n"
        "At least 2 raters\n"
        "n=40/arm is only large-effect pilot evidence\n"
        "n>=150/arm\n"
        "Exact N should be set after the pilot estimates baseline callback rate and sample yield.\n"
    )
    (root / "docs/paper/SCHEDULE_DECISION.md").write_text(design_text, encoding="utf-8")
    (root / "docs/paper/LONGITUDINAL_EXPERIMENT_PLAN.md").write_text(design_text, encoding="utf-8")
    (root / "docs/paper/PREREGISTRATION_PROTOCOL.md").write_text(
        "preregistration_status: draft_not_accepted\n"
        "accepted_schedule_required: true\n"
        "placebo_arm_status: local_plumbing_not_preregistered\n"
        "placebo_analysis_status: not_analyzed\n"
        "current_mechanism_claim: narrowed_read_block_suppression\n"
        "Inclusion Criteria\n"
        "Exclusion Criteria\n"
        "Deviation Policy\n"
        "no_arm_extension_after_effect_peeking: true\n",
        encoding="utf-8",
    )
    (root / "docs/paper/SCHEDULE_ACCEPTANCE.json").write_text(
        json.dumps({"accepted": False}),
        encoding="utf-8",
    )
    (root / "docs/paper/results/current-smoke/results/soul_uniqueness.csv").write_text(
        "scope,pair,marker,n,mean,ci_lo,ci_hi\n"
        "overall,ALL,emotional_expression_uniqueness,8,0.875,0.78125,0.96875\n"
        "overall,ALL,comfort_style_uniqueness,8,0.6875,0.5625,0.875\n"
        "overall,ALL,burden_response_uniqueness,8,0.6875,0.5625,0.875\n"
        "overall,ALL,human_aftertaste_score,8,0.87625,0.7525,0.95875\n"
        "overall,ALL,echo_similarity_penalty,8,0.04375,0.01375,0.07750000000000001\n"
        "overall,ALL,stage_direction_leak_penalty,8,0,0,0\n",
        encoding="utf-8",
    )
    for date, status, decision, source, callback, seen, cand, cb in [
        ("2026-06-04", "WARN", "sample_pending", "18:00-20:00", "20:00-22:00", 25, 4, 6),
        ("2026-06-05", "PASS", "continuity_observed", "14:00-16:00", "16:00-18:00", 22, 15, 2),
        ("2026-06-06", "WARN", "sample_pending", "none", "none", 2, 0, 0),
    ]:
        (root / f"docs/paper/results/repeatability/rolling-continuity-{date}.md").write_text(
            "# report\n\n## Summary\n\n"
            f"- Status: {status}\n"
            f"- Decision: {decision}\n"
            f"- Source window: {source}\n"
            f"- Callback window: {callback}\n"
            "- Source sample count: 3\n"
            "- Callback sample count: 2\n"
            f"- Source residue candidates: {cand}\n"
            f"- Rolling callbacks found: {cb}\n"
            f"- Today conversations seen in query: {seen}\n",
            encoding="utf-8",
        )
    dataset = [
        {"condition": "residue_on", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
        {"condition": "residue_on", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
        {"condition": "residue_off", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
        {"condition": "residue_off", "pair": "海-真晝", "metrics": {"human_aftertaste_score": 1.0}},
    ]
    (root / "docs/paper/results/longitudinal/dataset.json").write_text(json.dumps(dataset), encoding="utf-8")
    sheet = "blind_id,x\nER-0001,a\nER-0002,b\nER-0003,c\nER-0004,d\n"
    (root / "docs/paper/results/longitudinal/annotation_sheet.csv").write_text(sheet, encoding="utf-8")
    (root / "docs/paper/results/longitudinal/annotation_key.csv").write_text(sheet, encoding="utf-8")
    for i in range(1, 5):
        (root / f"docs/paper/results/longitudinal/blinded_transcripts/ER-{i:04d}.md").write_text(
            "Transcript text.",
            encoding="utf-8",
        )
    (root / "docs/paper/results/longitudinal/blinded_transcripts/transcripts.md").write_text(
        "Transcript text.",
        encoding="utf-8",
    )
    for path in [
        "docs/paper/results/current-smoke/results/summary.md",
        "docs/paper/results/longitudinal/results/summary.md",
    ]:
        (root / path).write_text("ok", encoding="utf-8")
    (root / "docs/paper/results/power/summary.md").write_text(
        "Cohen's h\n\n## Cluster Sensitivity\n\ndesign-effect approximation",
        encoding="utf-8",
    )
    (root / "docs/paper/results/power/cluster_power_grid.csv").write_text(
        "n_per_arm_nominal,cluster_size,icc\n40,4,0.05\n",
        encoding="utf-8",
    )
    paper_protocol_audit.write_fixture(root)
    paper_mechanism_audit.write_fixture(root)
    paper_pdf_preflight.write_fixture(root)
    paper_pdf_verification_audit.write_fixture(root, complete=False)
    paper_annotation_audit.write_fixture(root)
    paper_evidence_matrix_audit.write_fixture(root)
    paper_submission_audit.write_decisions(root, complete=False)
    (root / "scripts/paper/analyze.py").write_text(
        "CLUSTER_COLUMNS = ['pair', 'source_run', 'window']\n"
        "def cluster_unit_values(): pass\n"
        "def cluster_contrast(): pass\n"
        "# cluster_mean_diff pair|source_run|window\n",
        encoding="utf-8",
    )


def run_selftest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_minimal_claim_inputs(root)
        result, findings = generate_report(root, root / "docs/paper/results/readiness.md")
        assert result == "LOCAL_CONSERVATIVE_PREPRINT_SOURCE_READY"
        severities = {finding.severity for finding in findings}
        assert "EMPIRICAL_BLOCKER" in severities
        assert "EXTERNAL_BLOCKER" in severities
        assert (root / "docs/paper/results/arxiv-source/emotional-residue-arxiv-source.tar.gz").exists()

        (root / "docs/paper/arxiv/main.tex").write_text("[FILL]\n", encoding="utf-8")
        result, findings = generate_report(root, root / "docs/paper/results/readiness.md")
        assert result == "FAIL"
        assert any(f.check == "placeholder" or f.check == "main_placeholders" for f in findings)
    print("SELFTEST: PASS")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero on any non-PASS finding.")
    args = parser.parse_args(argv)

    if args.selftest:
        run_selftest()
        return 0

    result, findings = generate_report(args.root, args.out)
    print(args.out.read_text(encoding="utf-8"))
    if result == "FAIL" or (args.strict and any(f.severity != "PASS" for f in findings)):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
