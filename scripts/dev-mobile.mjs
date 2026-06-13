#!/usr/bin/env node
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';

const DEFAULT_FRONTEND_PORT = 5173;
const DEFAULT_CONVEX_PROXY_PORT = 13210;
const DEFAULT_CONVEX_SITE_PROXY_PORT = 13211;
const LOCAL_CONVEX_PORT = 3210;
const LOCAL_CONVEX_SITE_PORT = 3211;

function parseArgs(argv) {
  const options = {
    frontendPort: DEFAULT_FRONTEND_PORT,
    convexProxyPort: DEFAULT_CONVEX_PROXY_PORT,
    convexSiteProxyPort: DEFAULT_CONVEX_SITE_PROXY_PORT,
    host: process.env.MOBILE_HOST || '',
    noBackend: false,
    skipInit: false,
    noProxy: false,
    printOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      i += 1;
      return value;
    };

    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--print') options.printOnly = true;
    else if (arg === '--no-backend') options.noBackend = true;
    else if (arg === '--skip-init') options.skipInit = true;
    else if (arg === '--no-proxy') options.noProxy = true;
    else if (arg === '--host') options.host = readValue();
    else if (arg === '--frontend-port') options.frontendPort = Number(readValue());
    else if (arg === '--convex-proxy-port') options.convexProxyPort = Number(readValue());
    else if (arg === '--convex-site-proxy-port') options.convexSiteProxyPort = Number(readValue());
    else throw new Error(`Unknown option: ${arg}`);
  }

  for (const [name, value] of [
    ['frontendPort', options.frontendPort],
    ['convexProxyPort', options.convexProxyPort],
    ['convexSiteProxyPort', options.convexSiteProxyPort],
  ]) {
    if (!Number.isInteger(value) || value <= 0 || value > 65535) {
      throw new Error(`${name} must be a TCP port number`);
    }
  }

  return options;
}

function usage() {
  return `Usage: npm run dev:mobile -- [options]

Starts the local Underworld dev stack for a phone on the same Wi-Fi.

Options:
  --host <ip>                       Override detected LAN IP
  --frontend-port <port>            Vite port (default ${DEFAULT_FRONTEND_PORT})
  --convex-proxy-port <port>        LAN proxy to 127.0.0.1:${LOCAL_CONVEX_PORT} (default ${DEFAULT_CONVEX_PROXY_PORT})
  --convex-site-proxy-port <port>   LAN proxy to 127.0.0.1:${LOCAL_CONVEX_SITE_PORT} (default ${DEFAULT_CONVEX_SITE_PROXY_PORT})
  --no-backend                      Do not start convex dev
  --skip-init                       Skip the one-time convex init step
  --no-proxy                        Point the phone directly at ${LOCAL_CONVEX_PORT}/${LOCAL_CONVEX_SITE_PORT}
  --print                           Print detected URLs without starting servers
  -h, --help                        Show this help
`;
}

function detectLanHost() {
  const interfaces = os.networkInterfaces();
  const preferredNames = ['en0', 'en1', 'Wi-Fi', 'wlan0', 'eth0'];
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses || []) {
      if (
        address.family === 'IPv4' &&
        !address.internal &&
        !address.address.startsWith('169.254.')
      ) {
        candidates.push({ name, address: address.address });
      }
    }
  }

  for (const preferred of preferredNames) {
    const match = candidates.find((candidate) => candidate.name === preferred);
    if (match) return match.address;
  }
  return candidates[0]?.address || '';
}

function startTcpProxy({ listenPort, targetPort, label }) {
  const server = net.createServer((clientSocket) => {
    const targetSocket = net.connect(targetPort, '127.0.0.1');

    clientSocket.on('error', () => targetSocket.destroy());
    targetSocket.on('error', () => clientSocket.destroy());
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });

  return new Promise((resolve, reject) => {
    server.once('error', (error) => reject(error));
    server.listen(listenPort, '0.0.0.0', () => {
      console.log(`[mobile] ${label} proxy: 0.0.0.0:${listenPort} -> 127.0.0.1:${targetPort}`);
      resolve(server);
    });
  });
}

function spawnProcess(label, command, args, env) {
  const child = spawn(command, args, {
    env,
    stdio: 'inherit',
  });

  child.on('spawn', () => {
    console.log(`[mobile] started ${label}`);
  });
  return child;
}

function runOneShot(label, command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(label, command, args, env);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${signal || `code ${code}`}`));
    });
  });
}

function shutdown({ children, servers }, code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  for (const server of servers) {
    server.close();
  }
  process.exit(code);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[mobile] ${error.message}`);
    console.error(usage());
    process.exit(1);
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  const host = options.host || detectLanHost();
  if (!host) {
    console.error('[mobile] Could not detect a LAN IP. Pass one with --host <ip>.');
    process.exit(1);
  }

  const convexPort = options.noProxy ? LOCAL_CONVEX_PORT : options.convexProxyPort;
  const convexSitePort = options.noProxy ? LOCAL_CONVEX_SITE_PORT : options.convexSiteProxyPort;
  const frontendUrl = `http://${host}:${options.frontendPort}/ai-town`;
  const laptopUrl = `http://localhost:${options.frontendPort}/ai-town`;
  const convexUrl = `http://${host}:${convexPort}`;
  const convexSiteUrl = `http://${host}:${convexSitePort}`;
  const localConvexUrl = `http://127.0.0.1:${LOCAL_CONVEX_PORT}`;
  const localConvexSiteUrl = `http://127.0.0.1:${LOCAL_CONVEX_SITE_PORT}`;

  console.log(`[mobile] Phone URL: ${frontendUrl}`);
  console.log(`[mobile] Laptop URL: ${laptopUrl}`);
  console.log(`[mobile] VITE_CONVEX_URL=${convexUrl}`);
  console.log(`[mobile] VITE_CONVEX_URL_LOCAL=${localConvexUrl}`);
  console.log(`[mobile] VITE_CONVEX_SITE_URL=${convexSiteUrl}`);
  console.log(`[mobile] VITE_CONVEX_SITE_URL_LOCAL=${localConvexSiteUrl}`);
  console.log('[mobile] Same Wi-Fi only. Do not expose these ports to the public internet.');

  if (options.printOnly) return;

  const servers = [];
  if (!options.noProxy) {
    try {
      servers.push(
        await startTcpProxy({
          listenPort: options.convexProxyPort,
          targetPort: LOCAL_CONVEX_PORT,
          label: 'Convex',
        }),
      );
      servers.push(
        await startTcpProxy({
          listenPort: options.convexSiteProxyPort,
          targetPort: LOCAL_CONVEX_SITE_PORT,
          label: 'Convex site',
        }),
      );
    } catch (error) {
      console.error(`[mobile] Could not start proxy: ${error.message}`);
      console.error('[mobile] Stop the process using that port or choose another proxy port.');
      process.exit(1);
    }
  }

  const env = {
    ...process.env,
    CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS:
      process.env.CONVEX_LOCAL_BACKEND_STARTUP_TIMEOUT_SECS || '180',
    VITE_CONVEX_URL: convexUrl,
    VITE_CONVEX_URL_LOCAL: localConvexUrl,
    VITE_CONVEX_SITE_URL: convexSiteUrl,
    VITE_CONVEX_SITE_URL_LOCAL: localConvexSiteUrl,
  };

  const children = [];
  if (!options.noBackend && !options.skipInit) {
    try {
      await runOneShot(
        'Convex init',
        'npx',
        ['convex', 'dev', '--run', 'init', '--until-success'],
        env,
      );
    } catch (error) {
      console.error(`[mobile] ${error.message}`);
      shutdown({ children, servers }, 1);
    }
  }

  if (!options.noBackend) {
    children.push(spawnProcess('Convex backend', 'npx', ['convex', 'dev', '--tail-logs'], env));
  }
  children.push(
    spawnProcess('Vite frontend', 'npx', [
      'vite',
      '--host',
      '0.0.0.0',
      '--port',
      String(options.frontendPort),
      '--strictPort',
    ], env),
  );

  for (const child of children) {
    child.on('exit', (code, signal) => {
      if (signal) {
        console.log(`[mobile] ${child.spawnargs.join(' ')} exited with ${signal}`);
      } else if (code !== 0) {
        console.log(`[mobile] ${child.spawnargs.join(' ')} exited with code ${code}`);
      }
      shutdown({ children, servers }, code || 0);
    });
  }

  process.on('SIGINT', () => shutdown({ children, servers }, 0));
  process.on('SIGTERM', () => shutdown({ children, servers }, 0));
}

main();
