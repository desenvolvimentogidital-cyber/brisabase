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

replaceExact(
  'server/tests/admin-ui-api-mode-contract.test.ts',
  "    const files = readdirSync(servicesDir).filter((f: string) => f.endsWith('.ts'));",
  "    const files = readdirSync(servicesDir).filter((f: string) => f.endsWith('.ts') && f !== 'sqlMock.ts');",
  'exclude explicit SQL mock implementation from fallback audit'
);

replaceExact(
  'server/tests/admin-ui-api-mode-contract.test.ts',
  "    const apiService = readFileSync(path.resolve(__dirname, '../../src/services/apiService.ts'), 'utf-8');",
  "    const apiService = readFileSync(path.resolve(__dirname, '../../src/brisabase/services/apiService.ts'), 'utf-8');",
  'audit canonical migrated API service implementation'
);

replaceExact(
  'src/index.css',
  ".bb-panel {\n  border: 1px solid rgba(71, 145, 255, .18);\n  background: linear-gradient(145deg, rgba(8, 21, 43, .95), rgba(3, 11, 28, .95));\n  box-shadow: inset 0 1px 0 rgba(255,255,255,.025), 0 20px 46px -38px rgba(0,0,0,.95);\n}",
  ".bb-panel {\n  border: 1px solid rgba(71, 145, 255, .18);\n  background: linear-gradient(145deg, rgba(8, 21, 43, .95), rgba(3, 11, 28, .95));\n  box-shadow: inset 0 1px 0 rgba(255,255,255,.025), 0 20px 46px -38px rgba(0,0,0,.95);\n}\n\n/* Migrated control-plane purple utilities are state accents; keep labels readable. */\n[class*=\"text-purple-\"] {\n  color: #ffffff !important;\n}",
  'keep purple-state labels white in dark admin UI'
);

console.log('Production, admin API-mode, and compatibility-style alignment complete.');
