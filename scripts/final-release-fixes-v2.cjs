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

replaceExact(
  'server/tests/docker.integration.test.ts',
  "  const accessA = loginA.session.access_token as string;\n  const accessB = loginB.session.access_token as string;\n  const sdkA = new BrisaBaseClient({ url: apiUrl, projectId, environmentId, accessToken: accessA });",
  "  let accessA = loginA.session.access_token as string;\n  const accessB = loginB.session.access_token as string;\n  let sdkA = new BrisaBaseClient({ url: apiUrl, projectId, environmentId, accessToken: accessA });",
  'allow user A to recover with a fresh session after replay revocation'
);

replaceExact(
  'server/tests/docker.integration.test.ts',
  "  await expectStatus(await request('/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: firstRefresh }) }), 401, 'reused refresh token must be rejected');",
  "  await expectStatus(await request('/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: firstRefresh }) }), 401, 'reused refresh token must be rejected');\n  await expectStatus(await request('/api/auth/user', { headers: { authorization: `Bearer ${rotated.access_token}` } }), 401, 'refresh replay must revoke the rotated session family');\n  const recoveredLoginA = await login(userAEmail, password);\n  accessA = recoveredLoginA.session.access_token as string;\n  sdkA = new BrisaBaseClient({ url: apiUrl, projectId, environmentId, accessToken: accessA });\n  const userAAfterReplay = await expectStatus(await request('/api/auth/user', { headers: { authorization: `Bearer ${accessA}` } }), 200, 'new login after replay revocation');\n  assert.equal(userAAfterReplay.email, userAEmail);",
  'prove replay family revocation and establish a new independent session'
);

replaceExact(
  'server/tests/docker.integration.test.ts',
  "  await expectStatus(await request('/api/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${rotated.access_token}` } }), 200, 'logout');\n  await expectStatus(await request('/api/auth/user', { headers: { authorization: `Bearer ${rotated.access_token}` } }), 401, 'revoked session must reject get user');",
  "  await expectStatus(await request('/api/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${accessA}` } }), 200, 'logout');\n  await expectStatus(await request('/api/auth/user', { headers: { authorization: `Bearer ${accessA}` } }), 401, 'revoked session must reject get user');",
  'logout and verify the active post-replay session'
);

replaceExact(
  'server/billing/localBillingEngine.ts',
  'SELECT coalesce(sum(o.size_bytes),0)::text AS bytes FROM storage_objects o JOIN projects p ON p.id=o.project_id WHERE p.organization_id=$1',
  'SELECT coalesce(sum(o.size),0)::text AS bytes FROM storage_objects o JOIN projects p ON p.id=o.project_id WHERE p.organization_id=$1',
  'align billing storage usage with canonical storage object size column'
);

replaceExact(
  'server/tests/billing-enterprise-iac-phase8-contract.test.cjs',
  "const billing=read('server/billing/localBillingEngine.ts');const billingRoutes=read('server/routes/billing.ts');",
  "const billing=read('server/billing/localBillingEngine.ts');const billingRoutes=read('server/routes/billing.ts');const storageMigration=read('server/db/migrations/004_storage_metadata_persistence.sql');\nassert(/\\bsize BIGINT NOT NULL\\b/.test(storageMigration),'canonical storage object size column missing');\nassert(billing.includes('sum(o.size)'),'billing storage usage must use canonical storage_objects.size');\nassert(!billing.includes('sum(o.size_bytes)'),'billing must not use legacy storage_objects.size_bytes');",
  'guard billing and storage schema compatibility'
);

console.log('Production, admin API-mode, compatibility-style, Docker auth-session, and billing-storage schema alignment complete.');
