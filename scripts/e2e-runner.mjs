#!/usr/bin/env node
// Smoke E2E runner — exercises the real HTTP surface against a running stack.
//
// Usage:
//   docker compose up -d                   # or `npm run start:dev` against a local Postgres
//   docker compose exec api npm run migration:run
//   node scripts/e2e-runner.mjs            # or `npm run smoke:e2e`
//
// Honors env var BASE_URL (default http://127.0.0.1:3000/api/v1).
// Exits 0 on success, 1 on first failure with the failing step printed.

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const ts = Date.now();
const email = `qa_user_${ts}@example.com`;
const password = 'S3nh@Segura456';
const userName = `QA User ${ts}`;
const cnpj = String(10000000000000 + (ts % 89999999999999));

let stepNo = 0;
function logStep(label) {
  stepNo += 1;
  process.stdout.write(`\n[${String(stepNo).padStart(2, '0')}] ${label}\n`);
}

function logOk(detail) {
  process.stdout.write(`     OK  ${detail}\n`);
}

async function http(method, url, { body, token, accept } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (accept) headers.Accept = accept;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    const raw = await res.text();
    const err = new Error(`HTTP ${res.status} on ${method} ${url}`);
    err.status = res.status;
    err.body = raw;
    throw err;
  }
  if (ct.includes('application/pdf')) {
    return {
      kind: 'pdf',
      buffer: Buffer.from(await res.arrayBuffer()),
      headers: Object.fromEntries(res.headers.entries()),
    };
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { kind: 'json', body: json, headers: Object.fromEntries(res.headers.entries()) };
}

function expect(cond, message) {
  if (!cond) {
    const err = new Error(`Assertion failed: ${message}`);
    err.assertion = true;
    throw err;
  }
}

async function main() {
  process.stdout.write(`Audicon smoke E2E\nBase URL: ${BASE_URL}\n`);

  logStep('Health: liveness');
  let r = await http('GET', `${BASE_URL}/health/live`);
  expect(r.body.data?.status === 'ok', 'health/live should return data.status="ok"');
  logOk('status ok');

  logStep('Health: readiness');
  r = await http('GET', `${BASE_URL}/health/ready`);
  expect(
    r.body.data?.info?.database?.status === 'up',
    'health/ready should report database.status="up"',
  );
  logOk('database up');

  logStep('Users: create');
  r = await http('POST', `${BASE_URL}/users`, {
    body: { nome: userName, email, senha: password },
  });
  expect(r.body.data?.email === email, 'created user should echo email');
  expect(r.body.data?.senha === undefined, 'response must not leak senha');
  logOk(`user ${email}`);

  logStep('Auth: login');
  r = await http('POST', `${BASE_URL}/auth/login`, {
    body: { email, password },
  });
  const token = r.body.data?.access_token;
  expect(typeof token === 'string' && token.length > 20, 'login should return access_token');
  logOk(`token ${token.slice(0, 16)}…`);

  logStep('Auth: profile (JWT)');
  r = await http('GET', `${BASE_URL}/auth/profile`, { token });
  expect(r.body.data?.email === email, 'profile should match created user');
  logOk(`profile email=${r.body.data.email}`);

  logStep('Condominiums: create');
  r = await http('POST', `${BASE_URL}/condominiums`, {
    token,
    body: { name: `Condo QA ${ts}`, cnpj, address: 'Rua Teste, 123' },
  });
  const condoId = r.body.data?.id;
  expect(typeof condoId === 'number', 'created condominium should have numeric id');
  logOk(`condo #${condoId}`);

  logStep('Condominiums: list');
  r = await http('GET', `${BASE_URL}/condominiums`, { token });
  expect(Array.isArray(r.body.data), 'list should return an array');
  expect(r.body.data.some((c) => c.id === condoId), 'list should contain the created condo');
  logOk(`${r.body.data.length} found`);

  logStep('Condominiums: get by id');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}`, { token });
  expect(r.body.data?.cnpj === cnpj, 'cnpj should round-trip');
  logOk(`cnpj=${r.body.data.cnpj}`);

  logStep('Condominiums: patch address');
  r = await http('PATCH', `${BASE_URL}/condominiums/${condoId}`, {
    token,
    body: { address: 'Av. Atualizada, 456' },
  });
  expect(r.body.data?.address === 'Av. Atualizada, 456', 'address should update');
  logOk('address updated');

  logStep('Units: create');
  r = await http('POST', `${BASE_URL}/condominiums/${condoId}/units`, {
    token,
    body: { identifier: `A-${ts}`, ownerName: 'Fulano de Tal' },
  });
  const unitId = r.body.data?.id;
  expect(typeof unitId === 'number', 'created unit should have numeric id');
  logOk(`unit #${unitId}`);

  logStep('Units: list under condominium');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}/units`, { token });
  expect(Array.isArray(r.body.data) && r.body.data.length >= 1, 'units list should contain at least the new unit');
  logOk(`${r.body.data.length} unit(s)`);

  logStep('Units: get by id');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}/units/${unitId}`, { token });
  expect(r.body.data?.identifier === `A-${ts}`, 'identifier should round-trip');
  logOk(`identifier=${r.body.data.identifier}`);

  logStep('Units: patch ownerName');
  r = await http('PATCH', `${BASE_URL}/condominiums/${condoId}/units/${unitId}`, {
    token,
    body: { ownerName: 'Ciclano da Silva' },
  });
  expect(r.body.data?.ownerName === 'Ciclano da Silva', 'ownerName should update');
  logOk('ownerName updated');

  logStep('Infractions: create');
  r = await http('POST', `${BASE_URL}/infractions`, {
    token,
    body: {
      description: 'Morador toca som alto após 22h, perturbando vizinhos.',
      unitId,
    },
  });
  const infractionId = r.body.data?.id;
  expect(typeof infractionId === 'number', 'created infraction should have numeric id');
  expect(r.body.data?.status === 'pending', 'new infraction should be pending');
  logOk(`infraction #${infractionId}`);

  logStep('Infractions: list by unit');
  r = await http('GET', `${BASE_URL}/infractions?unitId=${unitId}`, { token });
  expect(Array.isArray(r.body.data) && r.body.data.length >= 1, 'should list at least the new infraction');
  logOk(`${r.body.data.length} infraction(s)`);

  logStep('Infractions: analyze (AI, falls back to mock without GEMINI_API_KEY)');
  r = await http('POST', `${BASE_URL}/infractions/${infractionId}/analyze`, { token });
  expect(r.body.data?.status === 'analyzed', 'status should flip to analyzed');
  expect(typeof r.body.data?.formalDescription === 'string' && r.body.data.formalDescription.length > 0,
    'formalDescription should be populated');
  logOk(`penalty=${r.body.data?.suggestedPenalty}`);

  logStep('Infractions: download single PDF');
  r = await http('GET', `${BASE_URL}/infractions/${infractionId}/document`, {
    token,
    accept: 'application/pdf',
  });
  expect(r.kind === 'pdf', 'response should be PDF');
  expect(r.buffer.slice(0, 5).toString() === '%PDF-', 'should start with %PDF-');
  expect(r.headers['content-disposition']?.includes('attachment'), 'should be attachment');
  logOk(`PDF ${r.buffer.length} bytes`);

  logStep('Reports: download consolidated PDF for condominium');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}/infractions/report.pdf`, {
    token,
    accept: 'application/pdf',
  });
  expect(r.kind === 'pdf', 'response should be PDF');
  expect(r.buffer.slice(0, 5).toString() === '%PDF-', 'should start with %PDF-');
  expect(r.headers['content-disposition']?.includes(`infractions-${condoId}-`),
    'filename should encode condominium id');
  logOk(`report PDF ${r.buffer.length} bytes`);

  logStep('Cleanup: delete infraction');
  await http('DELETE', `${BASE_URL}/infractions/${infractionId}`, { token });
  logOk(`infraction #${infractionId} deleted`);

  logStep('Cleanup: delete unit');
  await http('DELETE', `${BASE_URL}/condominiums/${condoId}/units/${unitId}`, { token });
  logOk(`unit #${unitId} deleted`);

  logStep('Cleanup: delete condominium');
  await http('DELETE', `${BASE_URL}/condominiums/${condoId}`, { token });
  logOk(`condo #${condoId} deleted`);

  process.stdout.write(`\nAll ${stepNo} steps passed.\n`);
}

main().catch((err) => {
  process.stderr.write(`\nFAILED at step ${stepNo}: ${err.message}\n`);
  if (err.body) process.stderr.write(`Response: ${err.body}\n`);
  if (err.stack && !err.assertion) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
