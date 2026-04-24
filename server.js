const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

const FILES = {
  profiles: path.join(DATA_DIR, 'profiles.json'),
  activeProfile: path.join(DATA_DIR, 'active_profile.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  properties: path.join(DATA_DIR, 'properties.json'),
  security: path.join(DATA_DIR, 'security_index.json')
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const defaultProfiles = [
  {
    id: 'perfil_principal',
    name: 'Perfil Principal',
    salaryGross: 0,
    otherIncome: 0,
    payrollDiscounts: 0,
    reserveMonthly: 0,
    housingPercent: 30,
    expenses: {
      food: 0,
      transport: 0,
      health: 0,
      internetPhone: 0,
      leisure: 0,
      debts: 0,
      education: 0,
      others: 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const defaultActiveProfile = { profileId: 'perfil_principal' };
const defaultSettings = { weights: { cost: 40, area: 20, location: 20, safety: 20 } };
const defaultProperties = [];
const defaultSecurityIndex = {
  icarai: { displayName: 'Icaraí', roubosRua: 2.1, roubosVeiculo: 1.4, letalidade: 0.3, tendencia: 0.8, observacao: 'Indicadores simulados em faixa relativamente favorável.' },
  centro: { displayName: 'Centro', roubosRua: 4.7, roubosVeiculo: 2.9, letalidade: 0.9, tendencia: -0.6, observacao: 'Movimento intenso e maior pressão sobre roubos de rua.' },
  santarosa: { displayName: 'Santa Rosa', roubosRua: 3.1, roubosVeiculo: 1.9, letalidade: 0.5, tendencia: 0.2, observacao: 'Faixa intermediária de risco no conjunto simulado.' },
  fonseca: { displayName: 'Fonseca', roubosRua: 3.8, roubosVeiculo: 2.2, letalidade: 0.8, tendencia: -0.2, observacao: 'Risco moderado a elevado na base simulada.' },
  barreto: { displayName: 'Barreto', roubosRua: 3.5, roubosVeiculo: 2.1, letalidade: 0.7, tendencia: 0.1, observacao: 'Risco moderado na base simulada.' },
  itaipu: { displayName: 'Itaipu', roubosRua: 1.7, roubosVeiculo: 1.1, letalidade: 0.2, tendencia: 0.6, observacao: 'Faixa favorável de segurança na base simulada.' },
  saofrancisco: { displayName: 'São Francisco', roubosRua: 2.0, roubosVeiculo: 1.5, letalidade: 0.3, tendencia: 0.5, observacao: 'Faixa favorável de segurança na base simulada.' },
  charitas: { displayName: 'Charitas', roubosRua: 1.8, roubosVeiculo: 1.2, letalidade: 0.2, tendencia: 0.5, observacao: 'Faixa favorável de segurança na base simulada.' },
  itaipuacu: { displayName: 'Itaipuaçu', roubosRua: 2.7, roubosVeiculo: 1.8, letalidade: 0.4, tendencia: 0.1, observacao: 'Faixa intermediária favorável na base simulada.' },
  inga: { displayName: 'Ingá', roubosRua: 2.3, roubosVeiculo: 1.7, letalidade: 0.3, tendencia: 0.4, observacao: 'Faixa relativamente favorável na base simulada.' }
};

async function ensureFile(filePath, defaultValue) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

async function ensureDataFiles() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await ensureFile(FILES.profiles, defaultProfiles);
  await ensureFile(FILES.activeProfile, defaultActiveProfile);
  await ensureFile(FILES.settings, defaultSettings);
  await ensureFile(FILES.properties, defaultProperties);
  await ensureFile(FILES.security, defaultSecurityIndex);
}

async function readJson(filePath, fallback) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(text);
}

async function getRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('JSON inválido no corpo da requisição.');
  }
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slugifyText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function slugifyNeighborhood(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function calculateSecurityScore(neighborhood, securityIndex) {
  const key = slugifyNeighborhood(neighborhood);
  const row = securityIndex[key];
  if (!row) {
    return {
      key,
      displayName: neighborhood || 'Não informado',
      score: null,
      explanation: 'Ainda não há dados simulados para este bairro. Edite o arquivo data/security_index.json para ampliar a cobertura da base.',
      factors: null
    };
  }

  const rawScore = 10 - (row.roubosRua * 0.8) - (row.roubosVeiculo * 0.6) - (row.letalidade * 1.4) + (row.tendencia * 0.7);
  const score = clamp(Number(rawScore.toFixed(1)), 0, 10);
  let label = 'Baixa pressão criminal simulada';
  if (score < 4) label = 'Faixa sensível';
  else if (score < 7) label = 'Faixa intermediária';

  return {
    key,
    displayName: row.displayName || neighborhood,
    score,
    explanation: `${label}. Base simulada: roubos de rua ${row.roubosRua}, roubos de veículo ${row.roubosVeiculo}, letalidade ${row.letalidade} e tendência ${row.tendencia}. ${row.observacao || ''}`.trim(),
    factors: {
      roubosRua: row.roubosRua,
      roubosVeiculo: row.roubosVeiculo,
      letalidade: row.letalidade,
      tendencia: row.tendencia
    }
  };
}

function sanitizeProfile(payload, currentProfile = {}) {
  const expenses = payload.expenses || currentProfile.expenses || {};
  const now = new Date().toISOString();
  return {
    id: currentProfile.id || payload.id || `perfil_${Date.now()}`,
    name: String(payload.name || currentProfile.name || 'Novo perfil').trim() || 'Novo perfil',
    salaryGross: normalizeNumber(payload.salaryGross),
    otherIncome: normalizeNumber(payload.otherIncome),
    payrollDiscounts: normalizeNumber(payload.payrollDiscounts),
    reserveMonthly: normalizeNumber(payload.reserveMonthly),
    housingPercent: clamp(normalizeNumber(payload.housingPercent), 0, 100),
    expenses: {
      food: normalizeNumber(expenses.food),
      transport: normalizeNumber(expenses.transport),
      health: normalizeNumber(expenses.health),
      internetPhone: normalizeNumber(expenses.internetPhone),
      leisure: normalizeNumber(expenses.leisure),
      debts: normalizeNumber(expenses.debts),
      education: normalizeNumber(expenses.education),
      others: normalizeNumber(expenses.others)
    },
    createdAt: currentProfile.createdAt || now,
    updatedAt: now
  };
}

function sanitizeSettings(payload) {
  const weights = payload.weights || {};
  return {
    weights: {
      cost: normalizeNumber(weights.cost),
      area: normalizeNumber(weights.area),
      location: normalizeNumber(weights.location),
      safety: normalizeNumber(weights.safety)
    }
  };
}

function sanitizeProperty(payload, currentProperty = {}) {
  const now = new Date().toISOString();
  return {
    id: currentProperty.id || payload.id || `imovel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    profileId: String(payload.profileId || currentProperty.profileId || '').trim(),
    title: String(payload.title || '').trim(),
    url: String(payload.url || '').trim(),
    rent: normalizeNumber(payload.rent),
    condo: normalizeNumber(payload.condo),
    iptu: normalizeNumber(payload.iptu),
    insurance: normalizeNumber(payload.insurance),
    fireInsurance: normalizeNumber(payload.fireInsurance),
    otherFees: normalizeNumber(payload.otherFees),
    area: normalizeNumber(payload.area),
    neighborhood: String(payload.neighborhood || '').trim(),
    localityScore: clamp(normalizeNumber(payload.localityScore), 0, 10),
    notes: String(payload.notes || '').trim(),
    favorite: Boolean(payload.favorite),
    createdAt: currentProperty.createdAt || now,
    updatedAt: now
  };
}

function enrichProperty(property, securityIndex) {
  const security = calculateSecurityScore(property.neighborhood, securityIndex);
  return {
    ...property,
    autoSafetyScore: security.score,
    securityExplanation: security.explanation,
    securityFactors: security.factors,
    securityDisplayName: security.displayName
  };
}

function toCsvCell(value) {
  const text = String(value ?? '');
  if (/[",;\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

async function exportPropertiesCsv(res, profileId) {
  const [properties, securityIndex] = await Promise.all([
    readJson(FILES.properties, defaultProperties),
    readJson(FILES.security, defaultSecurityIndex)
  ]);

  const filtered = profileId ? properties.filter((item) => item.profileId === profileId) : properties;
  const headers = [
    'Perfil','Título','Link','Favorito','Aluguel','Condomínio','IPTU','Seguro','Seguro incêndio','Outras taxas','Custo total','Área','Bairro','Nota localidade','Nota segurança automática','Observações'
  ];

  const rows = filtered.map((item) => {
    const enriched = enrichProperty(item, securityIndex);
    const total = item.rent + item.condo + item.iptu + item.insurance + item.fireInsurance + item.otherFees;
    return [
      item.profileId,
      item.title,
      item.url,
      item.favorite ? 'Sim' : 'Não',
      item.rent,
      item.condo,
      item.iptu,
      item.insurance,
      item.fireInsurance,
      item.otherFees,
      total,
      item.area,
      item.neighborhood,
      item.localityScore,
      enriched.autoSafetyScore ?? '',
      item.notes
    ].map(toCsvCell).join(';');
  });

  const csv = [headers.map(toCsvCell).join(';'), ...rows].join('\n');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="imoveis.csv"',
    'Cache-Control': 'no-store'
  });
  res.end('\ufeff' + csv);
}

async function handleApi(req, res, pathname, requestUrl) {
  if (req.method === 'GET' && pathname === '/api/state') {
    const [profiles, activeProfile, settings, properties, securityIndex] = await Promise.all([
      readJson(FILES.profiles, defaultProfiles),
      readJson(FILES.activeProfile, defaultActiveProfile),
      readJson(FILES.settings, defaultSettings),
      readJson(FILES.properties, defaultProperties),
      readJson(FILES.security, defaultSecurityIndex)
    ]);

    return sendJson(res, 200, {
      profiles,
      activeProfile,
      settings,
      properties: properties.map((item) => enrichProperty(item, securityIndex))
    });
  }

  if (req.method === 'GET' && pathname === '/api/security-score') {
    const securityIndex = await readJson(FILES.security, defaultSecurityIndex);
    const neighborhood = requestUrl.searchParams.get('bairro') || '';
    return sendJson(res, 200, calculateSecurityScore(neighborhood, securityIndex));
  }

  if (req.method === 'GET' && pathname === '/api/export/properties.csv') {
    const profileId = requestUrl.searchParams.get('profileId') || '';
    return exportPropertiesCsv(res, profileId || null);
  }

  if (req.method === 'POST' && pathname === '/api/profiles') {
    const payload = await getRequestBody(req);
    const profiles = await readJson(FILES.profiles, defaultProfiles);
    const name = String(payload.name || 'Novo perfil').trim() || 'Novo perfil';
    const baseId = slugifyText(name) || `perfil_${Date.now()}`;
    let id = baseId;
    let index = 2;
    while (profiles.some((item) => item.id === id)) {
      id = `${baseId}_${index++}`;
    }
    const now = new Date().toISOString();
    const profile = {
      id,
      name,
      salaryGross: 0,
      otherIncome: 0,
      payrollDiscounts: 0,
      reserveMonthly: 0,
      housingPercent: 30,
      expenses: { food: 0, transport: 0, health: 0, internetPhone: 0, leisure: 0, debts: 0, education: 0, others: 0 },
      createdAt: now,
      updatedAt: now
    };
    profiles.push(profile);
    await writeJson(FILES.profiles, profiles);
    return sendJson(res, 201, { ok: true, profile });
  }

  if (req.method === 'PUT' && pathname === '/api/active-profile') {
    const payload = await getRequestBody(req);
    const profiles = await readJson(FILES.profiles, defaultProfiles);
    const target = profiles.find((item) => item.id === payload.profileId);
    if (!target) return sendJson(res, 404, { ok: false, message: 'Perfil não encontrado.' });
    const activeProfile = { profileId: target.id };
    await writeJson(FILES.activeProfile, activeProfile);
    return sendJson(res, 200, { ok: true, activeProfile });
  }

  if (pathname.startsWith('/api/profiles/')) {
    const id = decodeURIComponent(pathname.split('/').pop() || '');
    const profiles = await readJson(FILES.profiles, defaultProfiles);
    const index = profiles.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { ok: false, message: 'Perfil não encontrado.' });

    if (req.method === 'PUT') {
      const payload = await getRequestBody(req);
      const updated = sanitizeProfile(payload, profiles[index]);
      profiles[index] = updated;
      await writeJson(FILES.profiles, profiles);
      return sendJson(res, 200, { ok: true, profile: updated });
    }

    if (req.method === 'DELETE') {
      if (profiles[index].id === 'perfil_principal') {
        return sendJson(res, 400, { ok: false, message: 'O perfil principal não pode ser excluído.' });
      }
      const activeProfile = await readJson(FILES.activeProfile, defaultActiveProfile);
      const properties = await readJson(FILES.properties, defaultProperties);
      const removed = profiles.splice(index, 1)[0];
      await writeJson(FILES.profiles, profiles);
      await writeJson(FILES.properties, properties.filter((item) => item.profileId !== removed.id));
      if (activeProfile.profileId === removed.id) {
        await writeJson(FILES.activeProfile, { profileId: 'perfil_principal' });
      }
      return sendJson(res, 200, { ok: true, profile: removed });
    }
  }

  if (req.method === 'PUT' && pathname === '/api/settings') {
    const payload = sanitizeSettings(await getRequestBody(req));
    await writeJson(FILES.settings, payload);
    return sendJson(res, 200, { ok: true, settings: payload });
  }

  if (req.method === 'POST' && pathname === '/api/properties') {
    const payload = sanitizeProperty(await getRequestBody(req));
    if (!payload.profileId) return sendJson(res, 400, { ok: false, message: 'Informe o perfil do imóvel.' });
    if (!payload.title) return sendJson(res, 400, { ok: false, message: 'Informe um título para o imóvel.' });
    if (!payload.neighborhood) return sendJson(res, 400, { ok: false, message: 'Informe o bairro para calcular a segurança automaticamente.' });
    const properties = await readJson(FILES.properties, defaultProperties);
    properties.push(payload);
    await writeJson(FILES.properties, properties);
    const securityIndex = await readJson(FILES.security, defaultSecurityIndex);
    return sendJson(res, 201, { ok: true, property: enrichProperty(payload, securityIndex) });
  }

  if (pathname.startsWith('/api/properties/')) {
    const id = decodeURIComponent(pathname.split('/').pop() || '');
    const properties = await readJson(FILES.properties, defaultProperties);
    const index = properties.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { ok: false, message: 'Imóvel não encontrado.' });

    if (req.method === 'PUT') {
      const payload = sanitizeProperty(await getRequestBody(req), properties[index]);
      if (!payload.profileId) return sendJson(res, 400, { ok: false, message: 'Informe o perfil do imóvel.' });
      if (!payload.title) return sendJson(res, 400, { ok: false, message: 'Informe um título para o imóvel.' });
      if (!payload.neighborhood) return sendJson(res, 400, { ok: false, message: 'Informe o bairro para calcular a segurança automaticamente.' });
      properties[index] = payload;
      await writeJson(FILES.properties, properties);
      const securityIndex = await readJson(FILES.security, defaultSecurityIndex);
      return sendJson(res, 200, { ok: true, property: enrichProperty(payload, securityIndex) });
    }

    if (req.method === 'DELETE') {
      const removed = properties.splice(index, 1)[0];
      await writeJson(FILES.properties, properties);
      return sendJson(res, 200, { ok: true, property: removed });
    }
  }

  return sendJson(res, 404, { ok: false, message: 'Rota de API não encontrada.' });
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, 'Acesso negado.');
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      return serveStatic(req, res, path.join(requestedPath, 'index.html'));
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fsp.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store'
    });
    return res.end(content);
  } catch {
    return sendText(res, 404, 'Arquivo não encontrado.');
  }
}

async function start() {
  await ensureDataFiles();
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host}`);
      const pathname = requestUrl.pathname;
      if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname, requestUrl);
      return await serveStatic(req, res, pathname);
    } catch (error) {
      console.error(error);
      return sendJson(res, 500, { ok: false, message: 'Erro interno no servidor.', detail: error.message });
    }
  });
  server.listen(PORT, () => {
    console.log(`Servidor da Plataforma de Moradia V3 rodando em http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Falha ao iniciar o servidor:', error);
  process.exit(1);
});
