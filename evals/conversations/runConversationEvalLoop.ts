import { spawn } from 'node:child_process';

const INTERVAL_MS = Number(process.env.CONVERSATION_EVAL_LOOP_INTERVAL_MS ?? 10 * 60 * 1000);

async function runOnce() {
  const started = new Date();
  console.log(`\n[${started.toISOString()}] Running recent conversation eval...`);
  await new Promise<void>((resolve) => {
    const child = spawn('npm', ['run', 'eval:conversation:recent'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.on('close', (code) => {
      const fallbackLine = output
        .split('\n')
        .find((line) => line.includes('falling back to local SQLite'));
      const summaryLine = output
        .split('\n')
        .find((line) => line.startsWith('Summary:'));
      const reportLine = output
        .split('\n')
        .find((line) => line.startsWith('Report:'));
      if (fallbackLine) console.log(fallbackLine);
      console.log(summaryLine ?? `Recent eval exited with code ${code ?? 'unknown'}.`);
      if (reportLine) console.log(reportLine);
      resolve();
    });
  });
}

async function main() {
  console.log(`GIIS conversation eval loop started. Interval: ${Math.round(INTERVAL_MS / 1000)}s`);
  console.log('This loop only reports quality. It never modifies code.');
  await runOnce();
  setInterval(() => {
    void runOnce();
  }, INTERVAL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
