#!/usr/bin/env node
/**
 * Call Message Center HTTP APIs. Paths must exist in references/api.json.
 *
 *   MC_TOKEN      interface token, prefix mct_
 *   MC_API_KEY    ingest key, prefix mck_
 *   MC_BASE_URL   optional, default http://localhost:3030
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(skillDir, 'references/api.json');

function usage(exit = 1) {
  console.error(`Usage:
  node message-center.mjs catalog [--json] [--method METHOD] [--path SUBSTR]
  node message-center.mjs show METHOD PATH
  node message-center.mjs call METHOD PATH [--json '{...}'] [--file body.json]

Env:
  MC_BASE_URL   default http://localhost:3030; production https://msg.aimo.plus
  MC_TOKEN      interface token (mct_…) for /api/me and /api/auth/me
  MC_API_KEY    ingest key (mck_…) for /api/v1/ingest/*
`);
  process.exit(exit);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--json') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.json = next;
        i += 1;
      } else {
        args.jsonOut = true;
      }
    } else if (token === '--file') {
      args.file = argv[++i];
    } else if (token === '--method') {
      args.method = argv[++i];
    } else if (token === '--path') {
      args.path = argv[++i];
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else if (token.startsWith('--')) {
      throw new Error(`Unknown flag ${token}`);
    } else {
      args._.push(token);
    }
  }
  return args;
}

function envConfig() {
  const baseUrl = (process.env.MC_BASE_URL ?? 'http://localhost:3030').replace(/\/+$/, '');
  return {
    baseUrl,
    token: process.env.MC_TOKEN ?? '',
    apiKey: process.env.MC_API_KEY ?? '',
  };
}

function loadCatalog() {
  if (!existsSync(catalogPath)) throw new Error(`Missing ${catalogPath}`);
  return JSON.parse(readFileSync(catalogPath, 'utf8'));
}

function normalizePath(value) {
  if (!value) return value;
  const noQuery = value.split('?')[0];
  return noQuery.startsWith('/') ? noQuery : `/${noQuery}`;
}

function pathTemplate(pathname) {
  return pathname.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id',
  );
}

function findEndpoint(catalog, method, pathname) {
  const m = method.toUpperCase();
  const exact = catalog.endpoints.find((ep) => ep.method === m && ep.path === pathname);
  if (exact) return exact;
  const templated = pathTemplate(pathname);
  return catalog.endpoints.find((ep) => ep.method === m && ep.path === templated);
}

function printCatalog(catalog, args) {
  const methodFilter = args.method?.toUpperCase();
  const pathFilter = args.path;
  const rows = catalog.endpoints.filter((ep) => {
    if (methodFilter && ep.method !== methodFilter) return false;
    if (pathFilter && !ep.path.includes(pathFilter)) return false;
    return true;
  });
  if (args.jsonOut) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  for (const ep of rows) {
    const auth = ep.auth === 'none' ? '' : `  ${ep.auth}`;
    console.log(`${ep.method.padEnd(6)} ${ep.path}${auth}`);
  }
  console.error(`# ${rows.length} endpoints`);
}

function printShow(ep) {
  if (!ep) {
    console.error('Endpoint not in catalog. Pass a real METHOD PATH from show.');
    process.exit(2);
  }
  console.log(`${ep.method} ${ep.path}`);
  console.log(`auth: ${ep.auth}`);
}

function readBody(args) {
  if (args.file) return readFileSync(args.file, 'utf8');
  if (args.json !== undefined) return args.json;
  return undefined;
}

function credential(ep, env) {
  if (ep.auth === 'none') return '';
  if (ep.auth === 'apikey') {
    if (!env.apiKey.startsWith('mck_')) {
      console.error('MC_API_KEY is not set. Use an ingest key (prefix mck_) from 接入密钥.');
      process.exit(2);
    }
    return env.apiKey;
  }
  if (!env.token.startsWith('mct_')) {
    console.error('MC_TOKEN is not set. Create one in 接口令牌 (prefix mct_) and export it.');
    console.error('MC_BASE_URL defaults to http://localhost:3030; production is https://msg.aimo.plus');
    process.exit(2);
  }
  return env.token;
}

async function callApi(catalog, method, pathname, args) {
  const env = envConfig();
  const pathOnly = normalizePath(pathname);
  const ep = findEndpoint(catalog, method, pathOnly);
  if (!ep) {
    console.error(`Not in catalog: ${method.toUpperCase()} ${pathOnly}`);
    console.error('Look up with: node message-center.mjs show METHOD PATH');
    process.exit(2);
  }
  const secret = credential(ep, env);
  const url = `${env.baseUrl}${pathOnly}`;
  const headers = { Accept: 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const body = readBody(args);
  const init = { method: ep.method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = body;
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (typeof parsed === 'string') console.log(parsed);
  else if (parsed !== undefined) console.log(JSON.stringify(parsed, null, 2));
  if (!res.ok) {
    console.error(`# HTTP ${res.status} ${ep.method} ${pathOnly}`);
    process.exit(1);
  }
  if (res.status === 204) console.error(`# HTTP 204 ${ep.method} ${pathOnly}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args._.length === 0) usage(args.help ? 0 : 1);

const command = args._[0];
if (command === 'catalog') {
  printCatalog(loadCatalog(), args);
} else if (command === 'show') {
  if (args._.length < 3) usage();
  printShow(findEndpoint(loadCatalog(), args._[1], normalizePath(args._[2])));
} else if (command === 'call') {
  if (args._.length < 3) usage();
  await callApi(loadCatalog(), args._[1], args._[2], args);
} else {
  usage();
}
