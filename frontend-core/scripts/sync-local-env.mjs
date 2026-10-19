import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(scriptDirectory, '..');
const workspaceEnvPath = resolve(frontendDirectory, '..', '.env');
const localEnvPath = resolve(frontendDirectory, '.env.local');

function parseEnv(source) {
  const values = new Map();
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    const quoted = rawValue.match(/^(['"])(.*)\1$/u);
    values.set(key, quoted ? quoted[2] : rawValue);
  }
  return values;
}

async function readOptional(path) {
  try {
    await access(path, constants.R_OK);
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

const workspaceValues = parseEnv(await readOptional(workspaceEnvPath));
const currentValues = parseEnv(await readOptional(localEnvPath));

const mappings = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  ['SUPABASE_JWT_SECRET', 'SUPABASE_JWT_SECRET'],
  ['NEXT_PUBLIC_LIVEKIT_URL', 'LIVEKIT_URL'],
  ['LIVEKIT_API_KEY', 'LIVEKIT_API_KEY'],
  ['LIVEKIT_API_SECRET', 'LIVEKIT_API_SECRET'],
  ['PROFILE_REVIEW_API_URL', 'PROFILE_ENGINE_URL'],
  ['INTERVIEW_SERVICE_URL', 'INTERVIEW_SERVICE_URL'],
  ['AUTOMATION_API_URL', 'AUTOMATION_API_URL'],
];

for (const [targetKey, sourceKey] of mappings) {
  if (currentValues.get(targetKey)) continue;
  const sourceValue = workspaceValues.get(sourceKey);
  if (sourceValue) currentValues.set(targetKey, sourceValue);
}

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const missing = required.filter((key) => !currentValues.get(key));
if (missing.length > 0) {
  throw new Error(`Unable to create .env.local; missing source values for: ${missing.join(', ')}`);
}

const output = [...currentValues.entries()]
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');
await writeFile(localEnvPath, `${output}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`Synced ${currentValues.size} local environment variables without printing values.`);
