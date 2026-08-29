const DEFAULT_API_URL = process.env.ADMIN_UI_URL || 'http://localhost:3000';
const RUN_ID = String(process.env.GITHUB_RUN_ID || process.env.ADMIN_SMOKE_RUN_ID || 'local').replace(/[^a-zA-Z0-9_-]/g, '-');

export const RELEASE_ADMIN_EMAIL = process.env.ADMIN_SMOKE_EMAIL || `release-admin-${RUN_ID}@brisabase.local`;
export const RELEASE_ADMIN_PASSWORD = process.env.ADMIN_SMOKE_PASSWORD || 'SuperSecretSmokePassword123!';
const ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN || 'local-bootstrap-token-for-isolated-e2e-only-2026';

export interface ReleaseAdminSession {
  access_token: string;
  user: Record<string, unknown>;
}

async function payload(response: Response): Promise<any> {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

async function login(apiUrl: string): Promise<Response> {
  return fetch(`${apiUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: RELEASE_ADMIN_EMAIL, password: RELEASE_ADMIN_PASSWORD }),
  });
}

export async function ensureReleaseAdmin(apiUrl = DEFAULT_API_URL): Promise<ReleaseAdminSession> {
  let response = await login(apiUrl);
  if (response.status === 401) {
    const signup = await fetch(`${apiUrl}/api/admin/auth/signup`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-bootstrap-token': ADMIN_BOOTSTRAP_TOKEN,
      },
      body: JSON.stringify({
        email: RELEASE_ADMIN_EMAIL,
        password: RELEASE_ADMIN_PASSWORD,
        name: 'BrisaBase Release Owner',
      }),
    });
    const signupBody = await payload(signup);
    if (![201, 409].includes(signup.status)) {
      throw new Error(`Release admin initialization failed with HTTP ${signup.status}: ${JSON.stringify(signupBody)}`);
    }
    response = await login(apiUrl);
  }
  const body = await payload(response);
  if (response.status !== 200 || !body?.access_token) {
    throw new Error(`Release admin login failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  await firstReleaseOrganization(body.access_token, apiUrl);
  return body as ReleaseAdminSession;
}

export async function firstReleaseOrganization(accessToken: string, apiUrl = DEFAULT_API_URL): Promise<string> {
  const response = await fetch(`${apiUrl}/api/organizations`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = await payload(response);
  if (response.status !== 200 || !Array.isArray(body)) {
    throw new Error(`Release organization lookup failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  if (body[0]?.id) return String(body[0].id);
  const created = await fetch(`${apiUrl}/api/organizations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Release Organization ${RUN_ID}`, slug: `release-organization-${RUN_ID}` }),
  });
  const createdBody = await payload(created);
  if (created.status !== 201 || !createdBody?.id) {
    throw new Error(`Release organization initialization failed with HTTP ${created.status}: ${JSON.stringify(createdBody)}`);
  }
  return String(createdBody.id);
}
