const { readFile } = require('node:fs/promises');
const path = require('node:path');

function fail(message) {
  throw new Error(`[BRISABASE DEPLOYMENT PROFILE ERROR] ${message}`);
}

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function url(name, value, schemes, options = {}) {
  let parsed;
  try { parsed = new URL(value); } catch { fail(`${name} must be a valid URL.`); }
  if (!schemes.includes(parsed.protocol)) fail(`${name} must use ${schemes.join(' or ')}.`);
  if (!parsed.hostname) fail(`${name} must include a hostname.`);
  if (options.public && ['localhost', '127.0.0.1', 'postgres', 'redis', 'minio', 'brisabase'].includes(parsed.hostname)) {
    fail(`${name} must point to external infrastructure for the enterprise profile.`);
  }
  return parsed;
}

function assertEquals(env, key, expected, profile) {
  if (env[key] !== expected) fail(`${profile} requires ${key}=${expected}.`);
}

async function main() {
  const [profile = 'hobby', envFile = profile === 'hobby' ? '.env.hobby' : profile === 'enterprise' ? '.env.enterprise' : '.env.production'] = process.argv.slice(2);
  if (!['hobby', 'self-hosted', 'enterprise'].includes(profile)) fail(`Unknown profile '${profile}'.`);
  const source = await readFile(path.resolve(envFile), 'utf8');
  const env = parseEnv(source);

  if (profile === 'hobby') {
    if (env.NODE_ENV === 'production') fail('hobby cannot use NODE_ENV=production.');
    if (env.BRISABASE_DEPLOYMENT_MODE && env.BRISABASE_DEPLOYMENT_MODE !== 'self-hosted') fail('hobby uses the local self-hosted Docker topology.');
    if (env.BRISABASE_PRODUCTION_TIER && env.BRISABASE_PRODUCTION_TIER !== 'single-host') fail('hobby must remain single-host.');
    process.stdout.write(JSON.stringify({ profile, valid: true, topology: 'local-bundled' }) + '\n');
    return;
  }

  if (profile === 'self-hosted') {
    assertEquals(env, 'NODE_ENV', 'production', profile);
    assertEquals(env, 'BRISABASE_DEPLOYMENT_MODE', 'self-hosted', profile);
    if ((env.BRISABASE_PRODUCTION_TIER || 'single-host') !== 'single-host') fail('self-hosted Compose is intentionally single-host; use enterprise for HA/external infrastructure.');
    process.stdout.write(JSON.stringify({ profile, valid: true, topology: 'single-host-production' }) + '\n');
    return;
  }

  assertEquals(env, 'NODE_ENV', 'production', profile);
  assertEquals(env, 'BRISABASE_DEPLOYMENT_MODE', 'managed', profile);
  assertEquals(env, 'BRISABASE_PRODUCTION_TIER', 'ha', profile);

  const database = url('DATABASE_URL', env.DATABASE_URL || '', ['postgres:', 'postgresql:'], { public: true });
  if (!database.username || !database.password) fail('DATABASE_URL must include a dedicated application username and password.');
  const migration = url('DATABASE_MIGRATION_URL', env.DATABASE_MIGRATION_URL || '', ['postgres:', 'postgresql:'], { public: true });
  if (!migration.username || !migration.password) fail('DATABASE_MIGRATION_URL must include a migration username and password.');
  const databaseTls = env.DATABASE_SSL === 'true' || ['require', 'verify-ca', 'verify-full'].includes((database.searchParams.get('sslmode') || '').toLowerCase());
  if (!databaseTls) fail('enterprise requires TLS for PostgreSQL (DATABASE_SSL=true or sslmode=require/verify-*).');

  const redis = url('REDIS_URL', env.REDIS_URL || '', ['redis:', 'rediss:'], { public: true });
  if (!redis.password) fail('REDIS_URL must be authenticated.');
  if (redis.protocol !== 'rediss:' && env.REDIS_TLS !== 'true') fail('enterprise requires Redis TLS via rediss:// or REDIS_TLS=true.');

  url('S3_ENDPOINT', env.S3_ENDPOINT || '', ['https:'], { public: true });
  url('APP_URL', env.APP_URL || '', ['https:'], { public: true });
  url('API_URL', env.API_URL || '', ['https:'], { public: true });
  if (env.STORAGE_PUBLIC_URL) url('STORAGE_PUBLIC_URL', env.STORAGE_PUBLIC_URL, ['https:'], { public: true });
  if (env.REALTIME_PUBLIC_URL) url('REALTIME_PUBLIC_URL', env.REALTIME_PUBLIC_URL, ['wss:'], { public: true });

  process.stdout.write(JSON.stringify({ profile, valid: true, topology: 'enterprise-external' }) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
});
