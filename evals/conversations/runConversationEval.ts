import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConversationEvalCase,
  ConversationEvalResult,
  evaluateConversationCase,
} from './metrics/conversation_metrics.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXTURE_FILES = [
  'umi_companion_cases.json',
  'agent_pair_cases.json',
  'bad_template_cases.json',
];

async function main() {
  const fixtureGroups = await Promise.all(FIXTURE_FILES.map(loadFixtureFile));
  const cases = fixtureGroups.flat();
  const results = cases.map(evaluateConversationCase);
  printSummary(results);
  printFailures(results);

  const unexpected = results.filter((result, index) => {
    const testCase = cases[index];
    return testCase.expected?.shouldFail ? result.status !== 'FAIL' : result.status === 'FAIL';
  });

  if (unexpected.length) {
    console.error('\nUnexpected eval result(s):');
    for (const result of unexpected) {
      const testCase = cases.find((item) => item.name === result.caseName);
      const expected = testCase?.expected?.shouldFail ? 'expected FAIL' : 'expected PASS/WARN';
      console.error(` - ${result.caseName}: ${result.status} (${expected})`);
    }
    process.exitCode = 1;
  }
}

async function loadFixtureFile(fileName: string): Promise<ConversationEvalCase[]> {
  const fullPath = join(__dirname, 'fixtures', fileName);
  const raw = await readFile(fullPath, 'utf8');
  return JSON.parse(raw) as ConversationEvalCase[];
}

function printSummary(results: ConversationEvalResult[]) {
  const rows = results.map((result) => ({
    case: result.caseName,
    mode: result.mode,
    status: result.status,
    score: result.overallScore.toFixed(2),
    failures: result.failures.length,
    warnings: result.warnings.length,
    notes: [...result.failures, ...result.warnings].slice(0, 2).join(' | ') || '-',
  }));
  console.log('\nGIIS Underworld Conversation Eval\n');
  console.table(rows);
  const pass = results.filter((result) => result.status === 'PASS').length;
  const warn = results.filter((result) => result.status === 'WARN').length;
  const fail = results.filter((result) => result.status === 'FAIL').length;
  console.log(`Summary: ${pass} PASS / ${warn} WARN / ${fail} FAIL`);
}

function printFailures(results: ConversationEvalResult[]) {
  const relevant = results.filter((result) => result.failures.length || result.warnings.length);
  if (!relevant.length) return;
  console.log('\nDetails:');
  for (const result of relevant) {
    console.log(`\n${result.caseName} (${result.status}, ${result.overallScore.toFixed(2)})`);
    for (const failure of result.failures) console.log(`  FAIL ${failure}`);
    for (const warning of result.warnings) console.log(`  WARN ${warning}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
