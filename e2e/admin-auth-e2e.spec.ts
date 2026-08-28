import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = `admin.${Date.now()}@brisabase.local`;
const ADMIN_PASSWORD = 'SuperSecretAdminPassword123!';

async function createAdminUser(page: Page): Promise<void> {
  // Sign up via API first
  const response = await page.request.post('/api/admin/auth/signup', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'E2E Admin' },
  });
  expect(response.status()).toBe(201);
}

async function login(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForSelector('text=BrisaBase Admin', { timeout: 15_000 });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

test.describe('Admin UI Authentication E2E', () => {
  test('Route protection: unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForURL('**/login', { timeout: 15_000 });
    await expect(page.locator('text=BrisaBase Admin')).toBeVisible();
  });

  test('Signup, login, access pages, logout, and post-logout block', async ({ page }) => {
    // Create admin user
    await createAdminUser(page);

    // Login
    await login(page);

    // Dashboard loads
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForTimeout(2_000);
    const dashboardHasContent = await page.locator('body').innerText();
    expect(dashboardHasContent.length).toBeGreaterThan(0);

    // Access each page
    const pages = [
      '/projects',
      '/team',
      '/settings',
      '/billing',
      '/docs',
    ];
    for (const path of pages) {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(1_000);
      // Should NOT redirect to login
      expect(page.url()).not.toContain('/login');
    }

    // Access project sub-pages
    const projectPages = [
      '/projects/proj_local_1/database',
      '/projects/proj_local_1/auth',
      '/projects/proj_local_1/storage',
      '/projects/proj_local_1/realtime',
      '/projects/proj_local_1/apis',
      '/projects/proj_local_1/security',
      '/projects/proj_local_1/monitoring',
    ];
    for (const path of projectPages) {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(1_000);
      expect(page.url()).not.toContain('/login');
    }

    // Logout
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);
    await page.click('button[title="Account"]');
    await page.waitForTimeout(500);
    await page.click('text=Sair');
    await page.waitForURL('**/login', { timeout: 15_000 });

    // After logout, dashboard should redirect to login
    await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForURL('**/login', { timeout: 15_000 });
    await expect(page.locator('text=BrisaBase Admin')).toBeVisible();
  });

  test('Invalid credentials are rejected', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30_000 });
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Invalid email or password', { timeout: 15_000 });
  });

  test('Forgot password flow shows success message', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'networkidle', timeout: 30_000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=If the account exists, reset instructions were sent.', { timeout: 15_000 });
  });
});
