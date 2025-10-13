// Usa fetch nativo do Node 18+

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const ts = Date.now();
const email = `qa_user_${ts}@example.com`;
const senha = 'S3nh@Segura456';
const nome = `QA User ${ts}`;

async function req(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.response = data;
    throw err;
  }
  return data;
}

async function main() {
  // Ping inicial para garantir disponibilidade
  const ping = await req('GET', `${API_BASE}/`);
  console.log('Ping resp:', JSON.stringify(ping, null, 2));
  console.log('Criando usuário:', email);
  const cu = await req('POST', `${API_BASE}/users`, { nome, email, senha });
  console.log('User resp:', JSON.stringify(cu, null, 2));

  console.log('Fazendo login...');
  const login = await req('POST', `${API_BASE}/auth/login`, { email, senha });
  console.log('Login resp:', JSON.stringify(login, null, 2));
  const token = login?.data?.access_token;
  if (!token) throw new Error('Falha no login: sem token');
  console.log('Token:', token.substring(0, 12) + '...');

  console.log('Consultando perfil protegido...');
  const profile = await req('GET', `${API_BASE}/auth/profile`, undefined, token);
  console.log('Profile resp:', JSON.stringify(profile, null, 2));

  console.log('Criando condomínio...');
  const cnpj = String(10000000000000 + (ts % 89999999999999));
  const cond = await req('POST', `${API_BASE}/condominios`, { nome: `Condomínio QA ${ts}`, cnpj, endereco: 'Rua Teste, 123' }, token);
  console.log('Condomínio resp:', JSON.stringify(cond, null, 2));
  const condId = cond?.data?.id;
  if (!condId) throw new Error('Falha ao criar condomínio');
  console.log('Condomínio:', condId);

  console.log('Listando condomínios...');
  const condList = await req('GET', `${API_BASE}/condominios`, undefined, token);
  console.log('Condomínios resp:', JSON.stringify(condList, null, 2));

  console.log('Buscando condomínio por ID...');
  const condGet = await req('GET', `${API_BASE}/condominios/${condId}`, undefined, token);
  console.log('Condomínio get resp:', JSON.stringify(condGet, null, 2));

  console.log('Atualizando condomínio...');
  const condUpd = await req('PATCH', `${API_BASE}/condominios/${condId}`, { endereco: 'Av. Atualizada, 456' }, token);
  console.log('Condomínio upd resp:', JSON.stringify(condUpd, null, 2));

  console.log('Criando unidade...');
  const uni = await req('POST', `${API_BASE}/condominios/${condId}/unidades`, { identificador: `Unidade QA ${ts}`, proprietario_nome: 'Fulano de Tal' }, token);
  console.log('Unidade resp:', JSON.stringify(uni, null, 2));
  const uniId = uni?.data?.id;
  if (!uniId) throw new Error('Falha ao criar unidade');
  console.log('Unidade:', uniId);

  console.log('Listando unidades do condomínio...');
  const uniList = await req('GET', `${API_BASE}/condominios/${condId}/unidades`, undefined, token);
  console.log('Unidades resp:', JSON.stringify(uniList, null, 2));

  console.log('Buscando unidade por ID...');
  const uniGet = await req('GET', `${API_BASE}/condominios/${condId}/unidades/${uniId}`, undefined, token);
  console.log('Unidade get resp:', JSON.stringify(uniGet, null, 2));

  console.log('Atualizando unidade...');
  const uniUpd = await req('PATCH', `${API_BASE}/condominios/${condId}/unidades/${uniId}`, { proprietario_nome: 'Ciclano da Silva' }, token);
  console.log('Unidade upd resp:', JSON.stringify(uniUpd, null, 2));

  console.log('Criando infração...');
  const inf = await req('POST', `${API_BASE}/unidades/${uniId}/infracoes`, { descricao: 'Morador realiza festas com som alto após 22h, prejudicando descanso dos vizinhos' }, token);
  console.log('Infração resp:', JSON.stringify(inf, null, 2));
  const infId = inf?.data?.id;
  if (!infId) throw new Error('Falha ao criar infração');
  console.log('Infração:', infId);

  console.log('Listando infrações da unidade...');
  const infList = await req('GET', `${API_BASE}/unidades/${uniId}/infracoes`, undefined, token);
  console.log('Infrações resp:', JSON.stringify(infList, null, 2));

  console.log('Buscando infração por ID...');
  const infGet = await req('GET', `${API_BASE}/unidades/${uniId}/infracoes/${infId}`, undefined, token);
  console.log('Infração get resp:', JSON.stringify(infGet, null, 2));

  console.log('Atualizando infração...');
  const infUpd = await req('PATCH', `${API_BASE}/unidades/${uniId}/infracoes/${infId}`, { descricao: 'Atualização: relato complementar sobre ocorrências anteriores.' }, token);
  console.log('Infração upd resp:', JSON.stringify(infUpd, null, 2));

  console.log('Chamando análise...');
  const analysis = await req('POST', `${API_BASE}/unidades/${uniId}/infracoes/${infId}/analisar`, {}, token);
  console.log('Análise resp:', JSON.stringify(analysis, null, 2));

  console.log('Removendo infração...');
  const infDel = await req('DELETE', `${API_BASE}/unidades/${uniId}/infracoes/${infId}`, undefined, token);
  console.log('Infração del resp:', JSON.stringify(infDel, null, 2));

  console.log('Removendo unidade...');
  const uniDel = await req('DELETE', `${API_BASE}/condominios/${condId}/unidades/${uniId}`, undefined, token);
  console.log('Unidade del resp:', JSON.stringify(uniDel, null, 2));

  console.log('Removendo condomínio...');
  const condDel = await req('DELETE', `${API_BASE}/condominios/${condId}`, undefined, token);
  console.log('Condomínio del resp:', JSON.stringify(condDel, null, 2));
}

main().catch((e) => {
  console.error('E2E error:', e.message);
  if (e.response) console.error('Response:', JSON.stringify(e.response, null, 2));
  process.exit(1);
});