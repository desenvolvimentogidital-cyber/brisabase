import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';

const API_URL = process.env.ADMIN_UI_URL || 'http://localhost:3000';
const PROJECT_ID = 'proj_local_1';
const ENVIRONMENT_ID = 'env_proj_local_1_development';
const runId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const table = `realtime_scope_${runId}`;

function waitForSocketMessage(socket: WebSocket, predicate: (message: any) => boolean, timeoutMs = 10_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('Timed out waiting for a Realtime message.'));
    }, timeoutMs);
    const onMessage = (raw: WebSocket.RawData) => {
      let message: any;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

async function signUpUser(email: string, password: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, project_id: PROJECT_ID, environment_id: ENVIRONMENT_ID }),
  });
  const data = await res.json();
  expect(res.status).toBe(201);
  return data;
}

async function loginUser(email: string, password: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, project_id: PROJECT_ID, environment_id: ENVIRONMENT_ID }),
  });
  const data = await res.json();
  expect(res.status).toBe(200);
  return data;
}

test.describe('Realtime Authentication and Scope E2E', () => {
  test('User A cannot access User B protected channels', async () => {
    const password = `Realtime-E2E-${runId}-Password!`;
    const userAEmail = `alice.${runId}@brisabase.local`;
    const userBEmail = `bob.${runId}@brisabase.local`;

    // Create two users
    await signUpUser(userAEmail, password);
    await signUpUser(userBEmail, password);
    const loginA = await loginUser(userAEmail, password);
    const loginB = await loginUser(userBEmail, password);
    const accessA = loginA.session.access_token as string;
    const accessB = loginB.session.access_token as string;

    // Create a table for the test
    const serviceKey = process.env.BRISABASE_E2E_SERVICE_KEY || 'bb_srv_local_development_only';
    const serviceHeaders = {
      apikey: serviceKey,
      'x-brisabase-service-bypass': 'true',
      'x-project-id': PROJECT_ID,
      'x-environment-id': ENVIRONMENT_ID,
      'content-type': 'application/json',
    };
    const createTable = await fetch(`${API_URL}/api/database/tables`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        name: table,
        columns: [
          { name: 'id', type: 'text', isPrimaryKey: true, isNullable: false },
          { name: 'owner_id', type: 'text', isNullable: false },
          { name: 'message', type: 'text', isNullable: false },
        ],
      }),
    });
    expect(createTable.status).toBe(201);

    // Add RLS policies
    for (const [operation, condition] of [
      ['SELECT', 'row.owner_id = auth.uid()'],
      ['INSERT', 'new.owner_id = auth.uid()'],
      ['UPDATE', 'row.owner_id = auth.uid() and new.owner_id = auth.uid()'],
      ['DELETE', 'row.owner_id = auth.uid()'],
    ]) {
      await fetch(`${API_URL}/api/security/policies`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify({
          name: `${operation.toLowerCase()} own ${table}`,
          resourceType: 'table',
          resource: table,
          operation,
          condition,
        }),
      });
    }

    // User A connects with their JWT
    const socketA = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/realtime/v1/websocket`);
    await new Promise<void>((resolve, reject) => { socketA.once('open', resolve); socketA.once('error', reject); });
    const connectedA = waitForSocketMessage(socketA, (message) => message.type === 'connected' && message.payload?.connectionId);
    socketA.send(JSON.stringify({ type: 'connect', token: accessA }));
    await connectedA;

    // User B connects with their JWT
    const socketB = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/realtime/v1/websocket`);
    await new Promise<void>((resolve, reject) => { socketB.once('open', resolve); socketB.once('error', reject); });
    const connectedB = waitForSocketMessage(socketB, (message) => message.type === 'connected' && message.payload?.connectionId);
    socketB.send(JSON.stringify({ type: 'connect', token: accessB }));
    await connectedB;

    // User A subscribes to the table
    const subscribedA = waitForSocketMessage(socketA, (message) => message.type === 'subscribed' && message.channel === 'scope-proof');
    socketA.send(JSON.stringify({ type: 'subscribe', channel: 'scope-proof', schema: 'public', table, event: '*' }));
    await subscribedA;

    // User B subscribes to the table
    const subscribedB = waitForSocketMessage(socketB, (message) => message.type === 'subscribed' && message.channel === 'scope-proof');
    socketB.send(JSON.stringify({ type: 'subscribe', channel: 'scope-proof', schema: 'public', table, event: '*' }));
    await subscribedB;

    // Insert a row owned by User A
    const insertA = waitForSocketMessage(socketA, (message) => message.type === 'event' && message.table === table && message.payload?.event === 'INSERT');
    const insertB = waitForSocketMessage(socketB, (message) => message.type === 'event' && message.table === table && message.payload?.event === 'INSERT');
    const inserted = await fetch(`${API_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({ id: 'alice-row', owner_id: loginA.user.id, message: 'private alice data' }),
    });
    expect(inserted.status).toBe(201);

    // User A should receive the INSERT event
    const eventA = await insertA;
    expect(eventA.payload.new.id).toBe('alice-row');

    // User B should NOT receive the INSERT event (RLS blocks it)
    let receivedByB = false;
    try {
      await Promise.race([
        insertB.then(() => { receivedByB = true; }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3_000)),
      ]);
    } catch {
      // Expected: User B should not receive User A's private data
    }
    expect(receivedByB).toBe(false);

    socketA.close();
    socketB.close();
  });
});
