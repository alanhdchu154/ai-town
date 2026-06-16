#!/usr/bin/env node
// Underworld MysteryDetector v1.
//
// Read-only report aggregator. It does not call Convex, mutate runtime state,
// render media, or upload anything.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUTPUT_JSON = join(REPO_ROOT, 'media', 'topics', 'mystery-candidates-latest.json');
const OUTPUT_MD = join(REPO_ROOT, 'media', 'topics', 'mystery-candidates-latest.md');

const SOURCE_PATHS = [
  'WORKLOG.md',
  'media/topics/watcher-inbox.md',
  'umi/reports/life-signals-latest.md',
  'umi/reports/rolling-continuity-latest.md',
  'umi/reports/v01-completion-audit-latest.md',
  'evals/conversations/reports/latest.md',
];

const ALLOWED = {
  types: new Set([
    'memory_anomaly',
    'repeated_behavior',
    'relationship_shift',
    'trust_shift',
    'social_loop_stagnation',
    'conflict_or_misunderstanding',
    'character_consistency',
    'personality_like_bug',
    'builder_failure',
  ]),
  formats: new Set([
    'field_note_short',
    'underworld_story',
    'research_episode',
    'builder_log',
    'observe_more',
    'do_not_use',
  ]),
  risks: new Set(['low', 'medium', 'high']),
  actions: new Set([
    'draft_short_candidate',
    'draft_video_outline',
    'backfill_story',
    'observe_more',
    'do_not_use',
  ]),
};

async function main() {
  const generatedAt = new Date().toISOString();
  const sources = await readSources();
  const candidates = rankCandidates(detectCandidates(sources));

  await mkdir(dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(candidates, null, 2)}\n`);
  await writeFile(OUTPUT_MD, renderMarkdown({ generatedAt, candidates, sources }));

  console.log(`MysteryDetector v1 wrote ${relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`MysteryDetector v1 wrote ${relative(REPO_ROOT, OUTPUT_MD)}`);
  console.log(`Candidates: ${candidates.length}`);
  if (candidates[0]) {
    console.log(`Top: ${candidates[0].score.toFixed(1)} ${candidates[0].title}`);
  }
}

async function readSources() {
  const entries = {};
  for (const path of SOURCE_PATHS) {
    entries[path] = await readText(path);
  }
  return entries;
}

async function readText(path) {
  try {
    return await readFile(join(REPO_ROOT, path), 'utf8');
  } catch {
    return '';
  }
}

function detectCandidates(sources) {
  const candidates = [];
  const watcher = sources['media/topics/watcher-inbox.md'];
  const rolling = sources['umi/reports/rolling-continuity-latest.md'];
  const life = sources['umi/reports/life-signals-latest.md'];
  const audit = sources['umi/reports/v01-completion-audit-latest.md'];
  const recent = sources['evals/conversations/reports/latest.md'];
  const worklog = sources['WORKLOG.md'];

  if (hasAny(`${watcher}\n${rolling}`, ['窗外的光', '手背', 'window light', 'light on someone'])) {
    candidates.push(storyCandidate({
      score: 9.4,
      type: 'memory_anomaly',
      title: 'Can AI Remember A Moment?',
      source_event: 'A window-light-on-hand detail from one conversation reappeared in a later callback.',
      why_interesting: 'A tiny sensory detail survived long enough to shape a later line, which is more watchable than an abstract memory claim.',
      public_safe_summary: 'A concrete detail from one conversation appeared again later, suggesting a small continuity signal.',
      mystery_angle: 'Did the character remember the moment, or did the system merely reuse a cue?',
      suggested_format: 'field_note_short',
      narrator_or_pov: 'Umi watcher diary with Ichinose / Mahiru visuals',
      risk_level: 'medium',
      evidence_links: [
        'umi/reports/rolling-continuity-latest.md',
        'media/topics/watcher-inbox.md',
      ],
      recommended_action: 'draft_short_candidate',
    }));
  }

  if (hasAny(watcher, ['promise exist in chat', 'not in memory', 'bubble tea', '珍珠奶茶'])) {
    candidates.push(storyCandidate({
      score: 9.1,
      type: 'memory_anomaly',
      title: 'Why Did The Promise Exist In Chat, But Not In Memory?',
      source_event: 'A pearl milk tea promise was present in dialogue, but the notebook/commitment layer came back empty.',
      why_interesting: 'It turns memory failure into a human-scale object: the system did not forget everything, it failed to preserve the thing that mattered tomorrow.',
      public_safe_summary: 'A character sounded committed in chat, but the structured memory layer failed to keep the concrete promise.',
      mystery_angle: 'When does a spoken promise become memory, and why did this one fall through?',
      suggested_format: 'field_note_short',
      narrator_or_pov: 'Umi bug-note narrator',
      risk_level: 'low',
      evidence_links: [
        'media/topics/watcher-inbox.md',
        'WORKLOG.md',
      ],
      recommended_action: 'backfill_story',
    }));
  }

  if (hasAny(life, ['Repeated Surface Lines', '排練鑰匙我收好了', '嗯，鑰匙收好就好'])) {
    candidates.push(storyCandidate({
      score: 8.8,
      type: 'repeated_behavior',
      title: 'Why Did My AI Characters Repeat The Rehearsal Key?',
      source_event: 'The life-signals report found repeated surface lines around rehearsal keys and the same reply pattern.',
      why_interesting: 'Repeated behavior can look like memory, but it may actually be a loop that prevents the world from moving socially.',
      public_safe_summary: 'Recent Underworld conversations repeated a specific rehearsal-key phrase pattern several times.',
      mystery_angle: 'Was this continuity, or was the world stuck on one object?',
      suggested_format: 'field_note_short',
      narrator_or_pov: 'Maomao diagnostic narrator or deadpan watcher diary',
      risk_level: 'low',
      evidence_links: [
        'umi/reports/life-signals-latest.md',
      ],
      recommended_action: 'draft_short_candidate',
    }));
  }

  if (hasAny(`${life}\n${audit}\n${recent}`, ['life_signal_repeated', 'event_thread_continuity | FAIL', 'mirror/motif repetition', 'social loop'])) {
    candidates.push(storyCandidate({
      score: 8.6,
      type: 'social_loop_stagnation',
      title: 'The World Had Details, But The Social Loop Was Stuck',
      source_event: 'Recent reports show campus-life cues and continuity, but repeated motifs and failed event-thread continuity keep the world from feeling free.',
      why_interesting: 'This is the central Underworld problem: detail is not the same thing as social movement.',
      public_safe_summary: 'Underworld produced many concrete daily-life cues, but repeated motifs made the social loop feel less alive.',
      mystery_angle: 'How can a world have memory and still fail to move forward?',
      suggested_format: 'underworld_story',
      narrator_or_pov: 'Umi field-note narrator',
      risk_level: 'medium',
      evidence_links: [
        'umi/reports/life-signals-latest.md',
        'umi/reports/v01-completion-audit-latest.md',
        'evals/conversations/reports/latest.md',
      ],
      recommended_action: 'draft_video_outline',
    }));
  }

  if (hasAny(`${worklog}\n${watcher}`, ['flicker', 'jump', 'interface blinked', 'UI jump', 'Conversation Wall'])) {
    candidates.push(storyCandidate({
      score: 7.8,
      type: 'builder_failure',
      title: 'The AI Was Thinking So Hard The Interface Blinked',
      source_event: 'A mobile playtest surfaced UI flicker/jump while background world queries competed with active conversation.',
      why_interesting: 'It shows that an AI society documentary includes boring infrastructure: the world can be alive while the interface still breaks the illusion.',
      public_safe_summary: 'A frontend instability made the world feel jumpy during active AI generation, then machine checks narrowed the issue.',
      mystery_angle: 'If the simulated society is alive, why did the window into it keep blinking?',
      suggested_format: 'builder_log',
      narrator_or_pov: 'deadpan documentary or Alan builder-confession premise',
      risk_level: 'low',
      evidence_links: [
        'WORKLOG.md',
        'media/topics/watcher-inbox.md',
      ],
      recommended_action: 'observe_more',
    }));
  }

  if (hasAny(recent, ['characterVoiceScore: matched 0', 'attention_shift: 0', 'emotion_behavior_link: 0'])) {
    candidates.push(storyCandidate({
      score: 7.6,
      type: 'character_consistency',
      title: 'The Characters Remembered Objects Better Than Each Other',
      source_event: 'Recent conversation evals flagged weak character voice, low attention shift, and motif mirroring across speakers.',
      why_interesting: 'It explains why a scene can have vivid props while still feeling emotionally flat.',
      public_safe_summary: 'Some recent conversations had concrete objects but weak character-specific movement.',
      mystery_angle: 'Can a character be detailed without being socially specific?',
      suggested_format: 'field_note_short',
      narrator_or_pov: 'Maomao diagnostic narrator',
      risk_level: 'medium',
      evidence_links: [
        'evals/conversations/reports/latest.md',
      ],
      recommended_action: 'observe_more',
    }));
  }

  return candidates;
}

function storyCandidate(candidate) {
  validateCandidate(candidate);
  return candidate;
}

function validateCandidate(candidate) {
  const required = [
    'score',
    'type',
    'title',
    'source_event',
    'why_interesting',
    'public_safe_summary',
    'mystery_angle',
    'suggested_format',
    'narrator_or_pov',
    'risk_level',
    'evidence_links',
    'recommended_action',
  ];
  for (const key of required) {
    if (!(key in candidate)) {
      throw new Error(`StoryCandidate missing ${key}`);
    }
  }
  if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 10) {
    throw new Error(`Invalid score for ${candidate.title}`);
  }
  if (!ALLOWED.types.has(candidate.type)) throw new Error(`Invalid type: ${candidate.type}`);
  if (!ALLOWED.formats.has(candidate.suggested_format)) {
    throw new Error(`Invalid suggested_format: ${candidate.suggested_format}`);
  }
  if (!ALLOWED.risks.has(candidate.risk_level)) {
    throw new Error(`Invalid risk_level: ${candidate.risk_level}`);
  }
  if (!ALLOWED.actions.has(candidate.recommended_action)) {
    throw new Error(`Invalid recommended_action: ${candidate.recommended_action}`);
  }
  if (!Array.isArray(candidate.evidence_links) || candidate.evidence_links.length === 0) {
    throw new Error(`StoryCandidate needs evidence_links: ${candidate.title}`);
  }
}

function rankCandidates(candidates) {
  const seen = new Set();
  return candidates
    .filter((candidate) => {
      const key = `${candidate.type}:${candidate.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function hasAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function renderMarkdown({ generatedAt, candidates, sources }) {
  const sourceRows = Object.entries(sources)
    .map(([path, text]) => `- ${path}: ${text ? 'present' : 'missing'}`)
    .join('\n');
  const rows = candidates.map(renderCandidate).join('\n\n');
  return `# Underworld Mystery Candidates\n\nGenerated: ${generatedAt}\n\nMode: read-only report aggregation. This file is not a script, upload package, or publishing decision.\n\n## Sources\n\n${sourceRows}\n\n## Ranked Candidates\n\n${rows || 'No candidates detected from current v1 sources.'}\n`;
}

function renderCandidate(candidate, index) {
  return `### ${index + 1}. ${candidate.title}\n\n` +
    `Score: ${candidate.score.toFixed(1)}\n\n` +
    `Type: ${candidate.type}\n\n` +
    `Source event: ${candidate.source_event}\n\n` +
    `Why interesting: ${candidate.why_interesting}\n\n` +
    `Public-safe summary: ${candidate.public_safe_summary}\n\n` +
    `Mystery angle: ${candidate.mystery_angle}\n\n` +
    `Suggested format: ${candidate.suggested_format}\n\n` +
    `Narrator / POV: ${candidate.narrator_or_pov}\n\n` +
    `Risk level: ${candidate.risk_level}\n\n` +
    `Evidence links:\n${candidate.evidence_links.map((link) => `- ${link}`).join('\n')}\n\n` +
    `Recommended action: ${candidate.recommended_action}\n`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
