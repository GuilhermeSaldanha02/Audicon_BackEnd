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
const MASTER_EMAIL = process.env.MASTER_EMAIL ?? 'master@audicon.com';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD ?? 'MasterAudicon@2026';

const ts = Date.now();
const companyCnpj = String(10000000000000 + (ts % 89999999999999)).replace(
  /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
  '$1.$2.$3/$4-$5',
);
const condoCnpj = String(20000000000000 + (ts % 79999999999999)).replace(
  /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
  '$1.$2.$3/$4-$5',
);

let stepNo = 0;
function logStep(label) {
  stepNo += 1;
  process.stdout.write(`\n[${String(stepNo).padStart(2, '0')}] ${label}\n`);
}

function logOk(detail) {
  process.stdout.write(`     OK  ${detail}\n`);
}

async function http(method, url, { body, cookie, accept } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // R-08: autenticação via cookie httpOnly (não mais Authorization: Bearer).
  if (cookie) headers.Cookie = cookie;
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

/**
 * R-08: faz login e extrai o cookie httpOnly `access_token` do Set-Cookie
 * (o token não vem mais no corpo). Retorna a string "access_token=<jwt>" para
 * reenviar via header Cookie nos requests autenticados.
 */
async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} on POST /auth/login`);
    err.status = res.status;
    err.body = await res.text();
    throw err;
  }
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean);
  const authCookie = setCookies
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('access_token='));
  return authCookie ?? null;
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

  // --- Master flow: create company + admin user ---

  logStep('Master: login');
  const masterCookie = await login(MASTER_EMAIL, MASTER_PASSWORD);
  expect(
    typeof masterCookie === 'string' && masterCookie.startsWith('access_token='),
    'master login should set the access_token cookie',
  );
  logOk('master cookie set (httpOnly)');

  logStep('Master: create company + admin');
  r = await http('POST', `${BASE_URL}/companies`, {
    cookie: masterCookie,
    body: {
      name: `QA Empresa ${ts}`,
      cnpj: companyCnpj,
      admin: { nome: `Admin QA ${ts}`, email: `qa_admin_${ts}@example.com` },
    },
  });
  const companyId = r.body.data?.company?.id;
  const adminEmail = r.body.data?.admin?.email;
  const adminTempPassword = r.body.data?.admin?.tempPassword;
  expect(typeof companyId === 'number', 'company should have numeric id');
  expect(typeof adminEmail === 'string', 'admin email should be returned');
  expect(typeof adminTempPassword === 'string' && adminTempPassword.length >= 12, 'tempPassword should be returned');
  logOk(`company #${companyId}, admin ${adminEmail}`);

  logStep('Master: list companies');
  r = await http('GET', `${BASE_URL}/companies`, { cookie: masterCookie });
  expect(Array.isArray(r.body.data), 'companies list should be an array');
  expect(r.body.data.some((c) => c.id === companyId), 'list should include the new company');
  logOk(`${r.body.data.length} companies`);

  logStep('Master: get company by id');
  r = await http('GET', `${BASE_URL}/companies/${companyId}`, { cookie: masterCookie });
  expect(r.body.data?.id === companyId, 'company id should match');
  logOk(`company name=${r.body.data.name}`);

  logStep('Master: list users of company');
  r = await http('GET', `${BASE_URL}/companies/${companyId}/users`, { cookie: masterCookie });
  expect(Array.isArray(r.body.data) && r.body.data.length >= 1, 'should have at least the admin');
  logOk(`${r.body.data.length} user(s)`);

  // --- Admin flow: login with temp password ---

  logStep('Admin: login with temp password');
  const adminCookie = await login(adminEmail, adminTempPassword);
  expect(
    typeof adminCookie === 'string' && adminCookie.startsWith('access_token='),
    'admin login should set the access_token cookie',
  );
  logOk('admin cookie set (httpOnly)');

  logStep('Admin: profile (cookie)');
  r = await http('GET', `${BASE_URL}/auth/profile`, { cookie: adminCookie });
  expect(r.body.data?.email === adminEmail, 'profile should match admin user');
  logOk(`profile email=${r.body.data.email}, companyId=${r.body.data.companyId}`);

  logStep('Condominiums: create');
  r = await http('POST', `${BASE_URL}/condominiums`, {
    cookie: adminCookie,
    body: { name: `Condo QA ${ts}`, cnpj: condoCnpj, address: 'Rua Teste, 123' },
  });
  const condoId = r.body.data?.id;
  expect(typeof condoId === 'number', 'created condominium should have numeric id');
  logOk(`condo #${condoId}`);

  logStep('Condominiums: list');
  r = await http('GET', `${BASE_URL}/condominiums`, { cookie: adminCookie });
  const condoList = Array.isArray(r.body.data) ? r.body.data : r.body.data?.data;
  expect(Array.isArray(condoList), 'list should return an array');
  expect(condoList.some((c) => c.id === condoId), 'list should contain the created condo');
  logOk(`${condoList.length} found`);

  logStep('Condominiums: get by id');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}`, { cookie: adminCookie });
  expect(r.body.data?.cnpj === condoCnpj, 'cnpj should round-trip');
  logOk(`cnpj=${r.body.data.cnpj}`);

  logStep('Condominiums: patch address');
  r = await http('PATCH', `${BASE_URL}/condominiums/${condoId}`, {
    cookie: adminCookie,
    body: { address: 'Av. Atualizada, 456' },
  });
  expect(r.body.data?.address === 'Av. Atualizada, 456', 'address should update');
  logOk('address updated');

  logStep('Units: create');
  r = await http('POST', `${BASE_URL}/condominiums/${condoId}/units`, {
    cookie: adminCookie,
    body: { identifier: `A-${ts}`, ownerName: 'Fulano de Tal' },
  });
  const unitId = r.body.data?.id;
  expect(typeof unitId === 'number', 'created unit should have numeric id');
  logOk(`unit #${unitId}`);

  logStep('Units: list under condominium');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}/units`, { cookie: adminCookie });
  const unitList = Array.isArray(r.body.data) ? r.body.data : r.body.data?.data;
  expect(Array.isArray(unitList) && unitList.length >= 1, 'units list should contain at least the new unit');
  logOk(`${unitList.length} unit(s)`);

  logStep('Units: get by id');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}/units/${unitId}`, { cookie: adminCookie });
  expect(r.body.data?.identifier === `A-${ts}`, 'identifier should round-trip');
  logOk(`identifier=${r.body.data.identifier}`);

  logStep('Units: patch ownerName');
  r = await http('PATCH', `${BASE_URL}/condominiums/${condoId}/units/${unitId}`, {
    cookie: adminCookie,
    body: { ownerName: 'Ciclano da Silva' },
  });
  expect(r.body.data?.ownerName === 'Ciclano da Silva', 'ownerName should update');
  logOk('ownerName updated');

  logStep('Infractions: create');
  r = await http('POST', `${BASE_URL}/infractions`, {
    cookie: adminCookie,
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
  r = await http('GET', `${BASE_URL}/infractions?unitId=${unitId}`, { cookie: adminCookie });
  const infractionList = Array.isArray(r.body.data) ? r.body.data : r.body.data?.data;
  expect(Array.isArray(infractionList) && infractionList.length >= 1, 'should list at least the new infraction');
  logOk(`${infractionList.length} infraction(s)`);

  logStep('Infractions: analyze (AI, falls back to mock without GEMINI_API_KEY)');
  r = await http('POST', `${BASE_URL}/infractions/${infractionId}/analyze`, { cookie: adminCookie });
  expect(r.body.data?.status === 'analyzed', 'status should flip to analyzed');
  expect(typeof r.body.data?.formalDescription === 'string' && r.body.data.formalDescription.length > 0,
    'formalDescription should be populated');
  logOk(`penalty=${r.body.data?.suggestedPenalty}`);

  logStep('Infractions: download single PDF');
  r = await http('GET', `${BASE_URL}/infractions/${infractionId}/document`, {
    cookie: adminCookie,
    accept: 'application/pdf',
  });
  expect(r.kind === 'pdf', 'response should be PDF');
  expect(r.buffer.slice(0, 5).toString() === '%PDF-', 'should start with %PDF-');
  expect(r.headers['content-disposition']?.includes('attachment'), 'should be attachment');
  logOk(`PDF ${r.buffer.length} bytes`);

  logStep('Reports: download consolidated PDF for condominium');
  r = await http('GET', `${BASE_URL}/condominiums/${condoId}/infractions/report.pdf`, {
    cookie: adminCookie,
    accept: 'application/pdf',
  });
  expect(r.kind === 'pdf', 'response should be PDF');
  expect(r.buffer.slice(0, 5).toString() === '%PDF-', 'should start with %PDF-');
  expect(r.headers['content-disposition']?.includes(`infractions-${condoId}-`),
    'filename should encode condominium id');
  logOk(`report PDF ${r.buffer.length} bytes`);

  logStep('Cleanup: delete infraction');
  await http('DELETE', `${BASE_URL}/infractions/${infractionId}`, { cookie: adminCookie });
  logOk(`infraction #${infractionId} deleted`);

  logStep('Cleanup: delete unit');
  await http('DELETE', `${BASE_URL}/condominiums/${condoId}/units/${unitId}`, { cookie: adminCookie });
  logOk(`unit #${unitId} deleted`);

  logStep('Cleanup: delete condominium');
  await http('DELETE', `${BASE_URL}/condominiums/${condoId}`, { cookie: adminCookie });
  logOk(`condo #${condoId} deleted`);

  process.stdout.write(`\nAll ${stepNo} steps passed.\n`);
}

main().catch((err) => {
  process.stderr.write(`\nFAILED at step ${stepNo}: ${err.message}\n`);
  if (err.body) process.stderr.write(`Response: ${err.body}\n`);
  if (err.stack && !err.assertion) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
