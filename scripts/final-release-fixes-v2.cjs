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

function replaceAllExact(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (!text.includes(before)) {
    if (text.includes(after)) return false;
    throw new Error(`Patch target not found in ${path}: ${label}`);
  }
  const count = text.split(before).length - 1;
  text = text.split(before).join(after);
  fs.writeFileSync(path, text, 'utf8');
  console.log(`patched ${path}: ${label} (${count} replacement${count === 1 ? '' : 's'})`);
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

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "const RUN_ID = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;\nconst ADMIN_EMAIL = process.env.ADMIN_SMOKE_EMAIL || `admin-ui-smoke-${RUN_ID}@brisabase.local`;\nconst ADMIN_PASSWORD = 'SuperSecretSmokePassword123!';\nconst ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN || 'local-bootstrap-token-for-isolated-e2e-only-2026';\nconst IS_FIXED_ADMIN_EMAIL = Boolean(process.env.ADMIN_SMOKE_EMAIL);",
  "const RUN_ID = String(process.env.ADMIN_SMOKE_RUN_ID || process.env.GITHUB_RUN_ID || 'local').replace(/[^a-zA-Z0-9_-]/g, '-');\nconst ADMIN_EMAIL = process.env.ADMIN_SMOKE_EMAIL || `admin-ui-smoke-${RUN_ID}@brisabase.local`;\nconst ADMIN_PASSWORD = 'SuperSecretSmokePassword123!';\nconst ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN || 'local-bootstrap-token-for-isolated-e2e-only-2026';",
  'reuse one deterministic smoke admin across Playwright worker restarts'
);

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "const PAGES = [\n  { path: () => '/dashboard', name: 'Dashboard' },\n  { path: () => '/projects', name: 'Projects' },\n  { path: () => `/projects/${PROJECT_ID}/database`, name: 'Database' },\n  { path: () => `/projects/${PROJECT_ID}/auth`, name: 'Authentication' },\n  { path: () => `/projects/${PROJECT_ID}/storage`, name: 'Storage' },\n  { path: () => `/projects/${PROJECT_ID}/realtime`, name: 'Realtime' },\n  { path: () => `/projects/${PROJECT_ID}/apis`, name: 'APIs' },\n  { path: () => `/projects/${PROJECT_ID}/logs`, name: 'Logs' },\n  { path: () => `/projects/${PROJECT_ID}/monitoring`, name: 'Observability' },\n  { path: () => '/team', name: 'Team' },\n  { path: () => '/settings', name: 'Settings' },\n  { path: () => '/billing', name: 'Billing' },\n  { path: () => '/docs', name: 'Documentation' },\n];",
  "const PAGES = [\n  { path: () => '/', name: 'Dashboard' },\n  { path: () => '/projects', name: 'Projects' },\n  { path: () => '/database', name: 'Database' },\n  { path: () => '/auth', name: 'Authentication' },\n  { path: () => '/storage', name: 'Storage' },\n  { path: () => '/realtime', name: 'Realtime' },\n  { path: () => '/apis', name: 'APIs' },\n  { path: () => '/logs', name: 'Logs' },\n  { path: () => '/observability', name: 'Observability' },\n  { path: () => '/members', name: 'Members' },\n  { path: () => '/settings', name: 'Settings' },\n  { path: () => '/billing', name: 'Billing' },\n  { path: () => '/docs', name: 'Documentation' },\n];",
  'exercise canonical BrowserRouter routes instead of catch-all redirects'
);

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "async function ensureSmokeAdmin(request: APIRequestContext) {\n  const signupResponse = await signUpSmokeAdmin(request);\n  if (signupResponse.status() === 201) {\n    const loginResponse = await loginSmokeAdmin(request);\n    if (loginResponse.status() !== 200) {\n      throw new Error(`Admin login after successful signup failed with HTTP ${loginResponse.status()}.`);\n    }\n    return loginResponse;\n  }\n\n  if (signupResponse.status() === 409 && IS_FIXED_ADMIN_EMAIL) {\n    const loginResponse = await loginSmokeAdmin(request);\n    if (loginResponse.status() === 200) return loginResponse;\n    throw new Error(`Admin signup returned HTTP 409 for fixed email, but the existing user could not authenticate (HTTP ${loginResponse.status()}).`);\n  }\n\n  throw new Error(`Admin signup expected HTTP 201${IS_FIXED_ADMIN_EMAIL ? ' or a verified fixed-email HTTP 409' : ''}, received HTTP ${signupResponse.status()}.`);\n}",
  "async function ensureSmokeAdmin(request: APIRequestContext) {\n  const existingLogin = await loginSmokeAdmin(request);\n  if (existingLogin.status() === 200) return existingLogin;\n  if (existingLogin.status() !== 401) {\n    throw new Error(`Existing smoke-admin login expected HTTP 200 or 401, received HTTP ${existingLogin.status()}.`);\n  }\n\n  const signupResponse = await signUpSmokeAdmin(request);\n  if (![201, 409].includes(signupResponse.status())) {\n    throw new Error(`Admin signup expected HTTP 201 or 409, received HTTP ${signupResponse.status()}.`);\n  }\n\n  const loginResponse = await loginSmokeAdmin(request);\n  if (loginResponse.status() !== 200) {\n    throw new Error(`Admin login after smoke-admin initialization failed with HTTP ${loginResponse.status()}.`);\n  }\n  return loginResponse;\n}",
  'reuse the existing smoke admin before exercising signup again'
);

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "  await page.goto(path, { waitUntil: 'networkidle', timeout: 30_000 });\n  await page.waitForTimeout(2_000);\n\n  // Check for critical console errors",
  "  await page.goto(path, { waitUntil: 'networkidle', timeout: 30_000 });\n  await page.waitForTimeout(2_000);\n  expect(new URL(page.url()).pathname, `${name} must stay on the requested canonical route`).toBe(path);\n\n  // Check for critical console errors",
  'reject catch-all redirects in page-load smoke coverage'
);

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "      window.localStorage.setItem('brisabase.organizationId', organizationId);\n      window.localStorage.setItem('brisabase.projectId', projectId);\n      window.localStorage.setItem('brisabase.environmentId', environmentId);",
  "      window.localStorage.setItem('brisabase.organizationId', organizationId);\n      window.localStorage.setItem('brisabase.projectId', projectId);\n      window.localStorage.setItem('brisabase.environmentId', environmentId);\n      window.localStorage.setItem('brisabase_active_project_id', projectId);\n      window.localStorage.setItem(`brisabase_environment_id:${projectId}`, environmentId);",
  'persist the active project and environment keys used by AppContext hydration'
);

replaceAllExact(
  'e2e/admin-ui-smoke.spec.ts',
  "    await page.goto(`/projects/${PROJECT_ID}/database`, { waitUntil: 'networkidle' });",
  "    await page.goto('/database', { waitUntil: 'networkidle' });",
  'exercise the canonical database route in focused browser tests'
);

replaceAllExact(
  'e2e/admin-ui-smoke.spec.ts',
  "    await page.goto(`/projects/${PROJECT_ID}/apis`, { waitUntil: 'networkidle' });",
  "    await page.goto('/apis', { waitUntil: 'networkidle' });",
  'exercise the canonical APIs route in focused browser tests'
);

replaceAllExact(
  'e2e/admin-ui-smoke.spec.ts',
  "    await page.goto('/dashboard', { waitUntil: 'networkidle' });",
  "    await page.goto('/', { waitUntil: 'networkidle' });",
  'exercise the canonical dashboard route'
);

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "    // Navigate to Team\n    await page.goto('/team', { waitUntil: 'networkidle' });\n    await page.waitForTimeout(1_000);\n    expect(page.url()).toContain('/team');",
  "    // Navigate to Members\n    await page.goto('/members', { waitUntil: 'networkidle' });\n    await page.waitForTimeout(1_000);\n    expect(page.url()).toContain('/members');",
  'navigate through the canonical members route'
);

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "    for (const label of ['Banco de Dados', 'Autenticação', 'Storage', 'Realtime', 'Security', 'APIs', 'Logs', 'Monitoramento']) {",
  "    for (const label of ['Banco de Dados', 'Autenticação', 'Storage', 'Realtime', 'Segurança', 'APIs', 'Logs', 'Observabilidade']) {",
  'validate the current Portuguese sidebar labels'
);

replaceExact(
  'e2e/admin-ui-smoke.spec.ts',
  "  test('Selected project text remains white', async ({ page }) => {\n    await page.goto('/projects', { waitUntil: 'networkidle' });\n\n    const activeProject = page.getByRole('button', { name: 'Projeto Ativo', exact: true });\n    await expect(activeProject).toHaveCount(1);\n    await expect(activeProject).toHaveClass(/text-white/);\n  });",
  "  test('Selected project text remains high-contrast', async ({ page }) => {\n    await page.goto('/projects', { waitUntil: 'networkidle' });\n\n    const activeProjectStatus = page.getByText('Projeto Ativo', { exact: true });\n    await expect(activeProjectStatus).toHaveCount(1);\n    const activeProjectButton = activeProjectStatus.locator('xpath=ancestor::button[1]');\n    await expect(activeProjectButton).toHaveCount(1);\n    await expect(activeProjectButton.locator('span.text-slate-100').first()).toBeVisible();\n  });",
  'assert high-contrast active project text on the element that actually renders it'
);

console.log('Production, admin API-mode, compatibility-style, Docker auth-session, billing-storage, and browser-route certification alignment complete.');
