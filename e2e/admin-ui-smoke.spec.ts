import { test, expect, Page } from '@playwright/test';
import { ensureReleaseScope } from './helpers/releaseAdmin';

let PROJECT_ID = '';
let ORGANIZATION_ID = '';
let ENVIRONMENT_ID = '';
let ACCESS_TOKEN = '';
let ADMIN_USER: Record<string, unknown> = {};

const PAGES = [
  { path: () => '/', name: 'Dashboard' },
  { path: () => '/projects', name: 'Projects' },
  { path: () => '/database', name: 'Database' },
  { path: () => '/auth', name: 'Authentication' },
  { path: () => '/storage', name: 'Storage' },
  { path: () => '/realtime', name: 'Realtime' },
  { path: () => '/apis', name: 'APIs' },
  { path: () => '/logs', name: 'Logs' },
  { path: () => '/observability', name: 'Observability' },
  { path: () => '/members', name: 'Members' },
  { path: () => '/settings', name: 'Settings' },
  { path: () => '/billing', name: 'Billing' },
  { path: () => '/docs', name: 'Documentation' },
];

async function checkPage(page: Page, path: string, name: string): Promise<void> {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const apiErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`Page error: ${err.message}`);
  });
  page.on('response', (response) => {
    const status = response.status();
    if (new URL(response.url()).pathname.startsWith('/api/') && ([401, 403, 429].includes(status) || status >= 500)) {
      apiErrors.push(`${status} ${response.request().method()} ${new URL(response.url()).pathname}`);
    }
  });

  await page.goto(path, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2_000);
  expect(new URL(page.url()).pathname, `${name} must stay on the requested canonical route`).toBe(path);

  // Check for critical console errors
  const criticalErrors = consoleErrors.filter((e) =>
    /Uncaught TypeError|Unhandled Promise Rejection|Failed to fetch|React error/i.test(e)
  );
  expect(criticalErrors, `Console errors on ${name}: ${criticalErrors.join('; ')}`).toEqual([]);
  expect(errors, `Page errors on ${name}: ${errors.join('; ')}`).toEqual([]);
  expect(apiErrors, `Unexpected API failures on ${name}: ${apiErrors.join('; ')}`).toEqual([]);

  // Check for horizontal overflow
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow, `Horizontal overflow on ${name}`).toBe(false);

  // A protected page is useful only when its real control-plane calls succeed.
  const errorState = await page.locator('text=Não foi possível carregar os dados').count();
  expect(errorState, `Protected page ${name} must not accept an API error state`).toBe(0);
}

async function openProjectNavigation(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: /Abrir menu de navegação|Open navigation menu/i });
  if (await menuButton.isVisible()) await menuButton.click();
}

test.describe('Admin UI Smoke Tests', () => {
  test.beforeAll(async () => {
    const { session, scope } = await ensureReleaseScope();
    ACCESS_TOKEN = session.access_token;
    ADMIN_USER = session.user;
    ORGANIZATION_ID = scope.organizationId;
    PROJECT_ID = scope.projectId;
    ENVIRONMENT_ID = scope.environmentId;
  });

  test.beforeEach(async ({ page }) => {
    // Authenticate each isolated browser context without repeatedly exercising
    // the brute-force-limited login endpoint. The session itself was issued by
    // the real API in beforeAll and every page still validates it server-side.
    await page.addInitScript(({ token, user, organizationId, projectId, environmentId }) => {
      window.sessionStorage.setItem('brisabase.admin.access_token', token);
      window.localStorage.setItem('brisabase.admin.user', JSON.stringify(user));
      window.localStorage.setItem('brisabase.organizationId', organizationId);
      window.localStorage.setItem('brisabase.projectId', projectId);
      window.localStorage.setItem('brisabase.environmentId', environmentId);
      window.localStorage.setItem('brisabase_active_project_id', projectId);
      window.localStorage.setItem(`brisabase_environment_id:${projectId}`, environmentId);
    }, { token: ACCESS_TOKEN, user: ADMIN_USER, organizationId: ORGANIZATION_ID, projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID });
  });

  for (const { path, name } of PAGES) {
    test(`${name} page loads without critical errors`, async ({ page }) => {
      await checkPage(page, path(), name);
    });
  }

  test('Database hydrates one validated persisted scope before real API calls', async ({ page }) => {
    const databaseRequests: Array<{ path: string; organizationId?: string; projectId?: string; environmentId?: string }> = [];
    const apiFailures: string[] = [];
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/database/')) return;
      databaseRequests.push({
        path: url.pathname,
        organizationId: response.request().headers()['x-organization-id'],
        projectId: response.request().headers()['x-project-id'],
        environmentId: response.request().headers()['x-environment-id'],
      });
      if ([401, 403, 429].includes(response.status()) || response.status() >= 500) {
        apiFailures.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
      }
    });

    await page.goto('/database', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);

    expect(apiFailures, `Database must reject unexpected API failures: ${apiFailures.join('; ')}`).toEqual([]);
    expect(databaseRequests.map((request) => request.path).sort()).toEqual([
      '/api/database/functions',
      '/api/database/indexes',
      '/api/database/migrations',
      '/api/database/overview',
      '/api/database/relationships',
      '/api/database/schemas',
      '/api/database/tables',
      '/api/database/triggers',
    ]);
    for (const request of databaseRequests) {
      expect(request.organizationId, `${request.path} must use the persisted organization`).toBe(ORGANIZATION_ID);
      expect(request.projectId, `${request.path} must use the persisted project`).toBe(PROJECT_ID);
      expect(request.environmentId, `${request.path} must use the persisted API environment`).toBe(ENVIRONMENT_ID);
    }
  });

  test('Database replaces invalid persisted scope with a real API scope', async ({ page }) => {
    const invalidScope = {
      organizationId: 'org_nonexistent_smoke',
      projectId: 'proj_nonexistent_smoke',
      environmentId: 'env_default_nonexistent_smoke',
    };
    const databaseRequests: Array<{ status: number; projectId?: string; environmentId?: string }> = [];
    await page.addInitScript((scope) => {
      window.localStorage.setItem('brisabase.organizationId', scope.organizationId);
      window.localStorage.setItem('brisabase.projectId', scope.projectId);
      window.localStorage.setItem('brisabase.environmentId', scope.environmentId);
    }, invalidScope);
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/database/')) return;
      databaseRequests.push({
        status: response.status(),
        projectId: response.request().headers()['x-project-id'],
        environmentId: response.request().headers()['x-environment-id'],
      });
    });

    await page.goto('/database', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);

    expect(databaseRequests).toHaveLength(8);
    for (const request of databaseRequests) {
      expect(request.status).toBeLessThan(400);
      expect(request.projectId).not.toBe(invalidScope.projectId);
      expect(request.environmentId).not.toBe(invalidScope.environmentId);
      expect(request.environmentId).not.toMatch(/^env_default_/);
    }
  });

  test('Navigation between pages works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);

    // Navigate to Projects
    await page.goto('/projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);
    expect(page.url()).toContain('/projects');

    // Navigate to Members
    await page.goto('/members', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);
    expect(page.url()).toContain('/members');

    // Navigate to Settings
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);
    expect(page.url()).toContain('/settings');
  });

  test('Sidebar keeps each project section exactly once after scope hydration', async ({ page }) => {
    await page.goto('/database', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);
    await openProjectNavigation(page);

    for (const label of ['Banco de Dados', 'Autenticação', 'Storage', 'Realtime', 'Segurança', 'APIs', 'Logs', 'Observabilidade']) {
      await expect(page.getByRole('link', { name: label, exact: true }), `${label} must not be duplicated in the sidebar`).toHaveCount(1);
    }
  });

  test('Selected project text remains high-contrast', async ({ page }) => {
    await page.goto('/projects', { waitUntil: 'networkidle' });

    const activeProjectStatus = page.getByText('Projeto Ativo', { exact: true });
    await expect(activeProjectStatus).toHaveCount(1);
    const activeProjectButton = activeProjectStatus.locator('xpath=ancestor::button[1]');
    await expect(activeProjectButton).toHaveCount(1);
    await expect(activeProjectButton.locator('span.text-slate-100').first()).toBeVisible();
  });

  test('APIs page does not call unavailable legacy webhook routes', async ({ page }) => {
    const legacyWebhookCalls: string[] = [];
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (/^\/api\/projects\/[^/]+\/webhooks$/.test(path)) legacyWebhookCalls.push(`${response.status()} ${path}`);
    });

    await page.goto('/apis', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);

    const webhookTab = page.getByRole('button', { name: 'Webhooks & Gateways', exact: true });
    await expect(webhookTab).toBeVisible();
    await webhookTab.click();
    await page.waitForTimeout(500);
    expect(legacyWebhookCalls, 'Supported webhooks must never fall back to the removed project-scoped webhook endpoint').toEqual([]);
  });

  test('Documentation provides in-product secure integration guidance', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Construa aplicações seguras com o BrisaBase.' })).toBeVisible();
    await expect(page.getByText('Central de documentação')).toBeVisible();
    await expect(page.getByText('Nunca use').first()).toBeVisible();

    await page.getByRole('button', { name: 'Banco de dados e RLS' }).click();
    await expect(page.getByRole('heading', { name: 'Banco de dados protegido por RLS' })).toBeVisible();
    await expect(page.getByText('Não crie policy').first()).toBeVisible();

    await page.getByRole('button', { name: 'Checklist antes do deploy' }).click();
    await expect(page.getByRole('heading', { name: 'Teste o isolamento da sua aplicação' })).toBeVisible();
  });

  test('Dashboard shows real data (never mock or error state)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    // Check that no mock activity strings appear (these are unique to the old mock data)
    const mockStrings = ['Há 2 min', 'Há 5 min', 'Há 8 min', 'Há 12 min', 'Há 22 min', 'Há 45 min'];
    for (const mock of mockStrings) {
      const count = await page.locator(`text=${mock}`).count();
      expect(count, `Mock data "${mock}" should not appear on Dashboard`).toBe(0);
    }

    // Check no static mock user emails appear
    const mockEmails = ['carlos@email.com', 'user_101a89b_avatar.jpg'];
    for (const mock of mockEmails) {
      const count = await page.locator(`text=${mock}`).count();
      expect(count, `Mock data "${mock}" should not appear on Dashboard`).toBe(0);
    }

    // The authenticated control plane must load real content.
    const hasError = await page.locator('text=Não foi possível carregar os dados').count() > 0;
    const hasContent = await page.locator('text=Bem-vindo ao').count() > 0;
    expect(hasError, 'Dashboard must not accept an API error state').toBe(false);
    expect(hasContent, 'Dashboard should show real authenticated content').toBe(true);
  });

  test('Billing shows "not configured" instead of fake financial data', async ({ page }) => {
    await page.goto('/billing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    // Check that no fake financial data appears
    const fakeFinancial = ['US$ 49.00', '25/08/2026', '4.5 GB / 10 GB', '256 GB / 500 GB', '1.2M / 2.0M', '124K / 500K'];
    for (const fake of fakeFinancial) {
      const count = await page.locator(`text=${fake}`).count();
      expect(count, `Fake financial data "${fake}" should not appear on Billing`).toBe(0);
    }
  });
});
