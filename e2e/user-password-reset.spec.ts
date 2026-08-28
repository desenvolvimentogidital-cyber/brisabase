import { test, expect } from '@playwright/test';

test.describe('Project user password reset page', () => {
  test('reset link opens the public new-password form without admin authentication', async ({ page }) => {
    const token = 'browser-smoke-reset-token-not-submitted';

    await page.goto(`/auth/v1/password-reset?token=${token}`, { waitUntil: 'networkidle' });

    expect(new URL(page.url()).pathname).toBe('/auth/v1/password-reset');
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await expect(page.getByLabel('New password')).toBeVisible();
    await expect(page.getByLabel('Confirm new password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update password' })).toBeEnabled();
    await expect(page.getByRole('heading', { name: /sign in/i })).toHaveCount(0);
  });

  test('missing token keeps the public page visible but disables submission', async ({ page }) => {
    await page.goto('/auth/v1/password-reset', { waitUntil: 'networkidle' });

    expect(new URL(page.url()).pathname).toBe('/auth/v1/password-reset');
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update password' })).toBeDisabled();
    await expect(page.getByText('Request a new recovery email from the application that created your account.')).toBeVisible();
  });
});
