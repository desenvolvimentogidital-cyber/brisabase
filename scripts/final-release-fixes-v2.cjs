const fs = require('node:fs');

function replaceExact(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (text.includes(after)) return false;
  if (!text.includes(before)) throw new Error(`Patch target not found in ${path}: ${label}`);
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log(`patched ${path}: ${label}`);
  return true;
}

replaceExact(
  'server/tests/production-config-contract.test.ts',
  "  ALERT_WEBHOOK_ENABLED: 'false', ALERT_WEBHOOK_URL: '', ALERT_WEBHOOK_TOKEN: '',\n};",
  "  ALERT_WEBHOOK_ENABLED: 'false', ALERT_WEBHOOK_URL: '', ALERT_WEBHOOK_TOKEN: '',\n  AI_PROVIDER_ALLOWED_HOSTS: 'api.openai.com',\n};",
  'include required AI provider allowlist in production fixture'
);

replaceExact(
  'server/config.ts',
  "    customDomainsEnabled: bool(process.env.HOSTING_CUSTOM_DOMAINS_ENABLED, production),",
  "    customDomainsEnabled: bool(process.env.HOSTING_CUSTOM_DOMAINS_ENABLED, false),",
  'make production custom domains explicit opt-in'
);

replaceExact(
  'server/tests/production-config-contract.test.ts',
  "assert.deepEqual(services, ['postgres', 'redis', 'minio', 'minio-init', 'brisabase', 'reverse-proxy'], 'Production Compose contains an unexpected runtime or is missing a required service.');",
  "assert.deepEqual(services, ['postgres', 'redis', 'minio', 'minio-init', 'functions-executor', 'brisabase', 'reverse-proxy'], 'Production Compose contains an unexpected runtime or is missing a required service.');",
  'recognize the isolated production functions executor'
);

replaceExact(
  'server/tests/production-config-contract.test.ts',
  "assert.doesNotMatch(serviceBlock, /mailpit|seed|mock|BACKUP_(?:ENCRYPTION_KEY|STORAGE_BUCKET)|server\\/backup\\/data/i, 'Production Compose contains a development fixture or disabled embedded-backup residue.');",
  "assert.doesNotMatch(serviceBlock, /mailpit|seed|mock|server\\/backup\\/data/i, 'Production Compose contains a development fixture or local backup fixture data.');\nassert.match(serviceBlock, /minio-init:[\\s\\S]*BACKUP_STORAGE_BUCKET/, 'Production MinIO bootstrap must provision the configured backup bucket.');\nassert.match(serviceBlock, /brisabase:[\\s\\S]*BACKUP_ENABLED: \\\"true\\\"[\\s\\S]*BACKUP_ENCRYPTION_KEY:[\\s\\S]*BACKUP_STORAGE_BUCKET:/, 'Production BrisaBase service must explicitly enable encrypted backups with a configured bucket.');",
  'recognize intentional production backup configuration'
);

console.log('Production configuration alignment complete.');
