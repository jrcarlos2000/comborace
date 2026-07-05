import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type SourceMode = 'replay' | 'live';

export interface Config {
  port: number;
  host: string;
  wsPath: string;
  staticDir: string;
  source: SourceMode;
  replayFile: string | null;
  speed: number;
  loop: boolean;
  txlineBase: string;
  txlineToken: string;
  fixtureId: string | null;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
// From server/src (dev) or server/dist (built), the repo layout puts the built app at ../../app/dist.
const DEFAULT_STATIC = path.resolve(HERE, '..', '..', 'app', 'dist');

interface CliArgs {
  [key: string]: string | boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function str(cli: CliArgs, key: string, env: string | undefined, fallback: string): string {
  const v = cli[key];
  if (typeof v === 'string') return v;
  if (env !== undefined && env !== '') return env;
  return fallback;
}

function num(cli: CliArgs, key: string, env: string | undefined, fallback: number): number {
  const raw = typeof cli[key] === 'string' ? (cli[key] as string) : env;
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function bool(cli: CliArgs, key: string, env: string | undefined, fallback: boolean): boolean {
  if (key in cli) return cli[key] === true || cli[key] === 'true';
  if (env !== undefined) return env === '1' || env.toLowerCase() === 'true';
  return fallback;
}

export function loadConfig(argv: string[] = process.argv.slice(2)): Config {
  const cli = parseArgs(argv);
  const e = process.env;

  const sourceRaw = str(cli, 'source', e.SOURCE, 'replay');
  const source: SourceMode = sourceRaw === 'live' ? 'live' : 'replay';

  const replayFile = ((): string | null => {
    const v = str(cli, 'in', e.REPLAY_FILE, '');
    return v === '' ? null : path.resolve(v);
  })();

  return {
    port: num(cli, 'port', e.PORT, 8080),
    host: str(cli, 'host', e.HOST, '0.0.0.0'),
    wsPath: str(cli, 'ws-path', e.WS_PATH, '/ws'),
    staticDir: path.resolve(str(cli, 'static-dir', e.STATIC_DIR, DEFAULT_STATIC)),
    source,
    replayFile,
    speed: Math.max(0.1, num(cli, 'speed', e.SPEED, 1)),
    loop: bool(cli, 'loop', e.LOOP, false),
    txlineBase: str(cli, 'txline-base', e.TXLINE_BASE, 'https://txline.txodds.com'),
    txlineToken: str(cli, 'txline-token', e.TXLINE_TOKEN, ''),
    fixtureId: ((): string | null => {
      const v = str(cli, 'fixture', e.FIXTURE_ID, '');
      return v === '' ? null : v;
    })(),
  };
}
