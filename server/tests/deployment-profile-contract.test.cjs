const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const hobby = read('docker-compose.hobby.yml');
const local = read('docker-compose.local.yml');
const enterprise = read('docker-compose.enterprise.yml');
const production = read('docker-compose.production.yml');
const enterpriseEnv = read('.env.enterprise.example');
const hobbyEnv = read('.env.hobby.example');
const deployScript = read('scripts/deployment-profile.cjs');
const profileValidator = read('scripts/validate-deployment-profile.cjs');
const adminAuth = read('server/routes/adminAuth.ts');
const realAuth = read('server/routes/realAuth.ts');
const securityBaseline = read('docs/SECURITY_BASELINE.md');
const deploymentDocs = read('docs/DEPLOYMENT_PROFILES.md');

assert.match(hobby, /BRISABASE_DEPLOYMENT_PROFILE:\s*hobby/);
assert.match(hobby, /BRISABASE_DEPLOYMENT_MODE:\s*self-hosted/);
assert.match(hobby, /BRISABASE_PRODUCTION_TIER:\s*single-host/);
assert.match(hobbyEnv, /NODE_ENV=development/);
assert.match(hobbyEnv, /BRISABASE_DEPLOYMENT_PROFILE=hobby/);

for (const port of ['BRISABASE_POSTGRES_PORT', 'BRISABASE_REDIS_PORT', 'BRISABASE_MINIO_PORT', 'BRISABASE_MINIO_CONSOLE_PORT', 'BRISABASE_SMTP_PORT', 'BRISABASE_MAILPIT_PORT', 'BRISABASE_PORT']) {
  assert.match(local, new RegExp(`127\\.0\\.0\\.1:\\$\\{${port}`), `local ${port} must bind to loopback`);
}

assert.match(enterprise, /BRISABASE_DEPLOYMENT_PROFILE:\s*enterprise/);
assert.match(enterprise, /BRISABASE_DEPLOYMENT_MODE:\s*managed/);
assert.match(enterprise, /BRISABASE_PRODUCTION_TIER:\s*ha/);
assert.doesNotMatch(enterprise, /^\s{2}(postgres|redis|minio|minio-init):\s*$/m, 'enterprise compose must not bundle stateful infrastructure');
assert.match(enterprise, /read_only:\s*true/);
assert.match(enterprise, /cap_drop:\s*\["ALL"\]/);
assert.match(enterprise, /no-new-privileges:true/);
assert.match(enterprise, /internal:\s*true/);
assert.match(enterprise, /BRISABASE_BIND_ADDRESS:-127\.0\.0\.1/);

assert.match(enterpriseEnv, /BRISABASE_DEPLOYMENT_MODE=managed/);
assert.match(enterpriseEnv, /BRISABASE_PRODUCTION_TIER=ha/);
assert.match(enterpriseEnv, /DATABASE_SSL=true/);
assert.match(enterpriseEnv, /REDIS_URL=rediss:\/\//);
assert.match(enterpriseEnv, /S3_ENDPOINT=https:\/\//);

assert.match(production, /BRISABASE_DEPLOYMENT_MODE:\s*self-hosted/);
assert.match(production, /BRISABASE_PRODUCTION_TIER:\s*\$\{BRISABASE_PRODUCTION_TIER:-single-host\}/);
assert.match(production, /functions-plane:/);
assert.match(production, /internal:\s*true/);

assert.match(adminAuth, /redisClient\.increment\(`rate:admin:/, 'admin auth rate limiting must use shared Redis');
assert.match(realAuth, /redisClient\.increment\(`rate:auth:/, 'application auth rate limiting must use shared Redis');
assert.doesNotMatch(adminAuth, /from ['"]\.\.\/auth\/rateLimiter['"]/);
assert.doesNotMatch(realAuth, /from ['"]\.\.\/auth\/rateLimiter['"]/);

assert.match(deployScript, /hobby/);
assert.match(deployScript, /self-hosted/);
assert.match(deployScript, /enterprise/);
assert.match(deployScript, /validate-deployment-profile\.cjs/);
assert.match(profileValidator, /enterprise requires TLS for PostgreSQL/);
assert.match(profileValidator, /enterprise requires Redis TLS/);
assert.match(profileValidator, /S3_ENDPOINT/);

assert.match(securityBaseline, /distributed limiter/i);
assert.match(securityBaseline, /Do not describe the bundled Compose as HA/);
assert.match(deploymentDocs, /Hobby \/ Local/);
assert.match(deploymentDocs, /Self-Hosted/);
assert.match(deploymentDocs, /Enterprise \/ External Infrastructure/);
assert.match(deploymentDocs, /plan vs deployment profile/i);

console.log('deployment-profile-contract.test.cjs: ok');
