import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { getAnalyticsDb, getClientProfile } from '../store/analyticsDb.mjs';

const DEFAULT_MASTER_PASSWORD = 'Consultoria@2026';
const LICENSE_SECRET = process.env.BIG_LICENSE_SECRET || 'BIG_FARMA_SAAS_SECRET_KEY_PROD_2026#7912';

/**
 * Garante as tabelas de segurança, licenças e controle de clientes do dono no SQLite
 */
function ensureLicenseTable() {
  const db = getAnalyticsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS system_licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_code TEXT NOT NULL,
      cnpj TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      license_key TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      plan_type TEXT DEFAULT 'mensal',
      max_filiais INTEGER DEFAULT 1,
      status TEXT DEFAULT 'ACTIVE',
      activated_at TEXT,
      signature TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS issued_licenses_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      cnpj TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      contact_phone TEXT,
      monthly_price REAL DEFAULT 0,
      plan_type TEXT DEFAULT 'mensal',
      days INTEGER DEFAULT 30,
      license_key TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

/**
 * Obtém a senha master atual configurada (prioridade: SQLite > .env > default)
 */
export function getMasterPassword() {
  ensureLicenseTable();
  const db = getAnalyticsDb();
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'master_password'").get();
    if (row && row.value && row.value.trim()) {
      return row.value.trim();
    }
  } catch (err) {
    // Silently continue to env fallback
  }
  return (process.env.BIG_MASTER_PASSWORD && process.env.BIG_MASTER_PASSWORD.trim()) || DEFAULT_MASTER_PASSWORD;
}

/**
 * Atualiza a senha master no SQLite e no arquivo .env
 */
export function updateMasterPassword(currentPassword, newPassword) {
  if (!verifyMasterPassword(currentPassword)) {
    throw new Error('Senha Master atual incorreta. Acesso negado.');
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
  }

  const cleanNew = newPassword.trim();
  ensureLicenseTable();
  const db = getAnalyticsDb();

  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('master_password', ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(cleanNew);

  process.env.BIG_MASTER_PASSWORD = cleanNew;

  // Higieniza o arquivo .env para que nunca exponha senhas em texto puro
  sanitizeEnvFile();

  return { ok: true, message: '✓ Senha Master atualizada com sucesso no banco de dados blindado!' };
}

/**
 * Remove qualquer credencial ou senha em texto puro do .env
 */
export function sanitizeEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/).filter((l) => {
        const t = l.trim();
        if (!t || t.startsWith('#')) return true;
        if (t.startsWith('BIG_MASTER_PASSWORD=') || t.startsWith('DB_PASSWORD=') || t.startsWith('DB_USER=')) return false;
        return true;
      });
      fs.writeFileSync(envPath, lines.join('\r\n'), 'utf8');
    }
  } catch (err) {
    // Silencioso
  }
}

/**
 * Gera um ID de máquina único e persistente baseado no hardware
 */
export function getMachineFingerprint() {
  const cpus = os.cpus();
  const cpuModel = cpus && cpus[0] ? cpus[0].model : 'CPU_GENERIC';
  const network = os.networkInterfaces();
  let mac = '';
  for (const name of Object.keys(network)) {
    for (const net of network[name] || []) {
      if (net.mac && net.mac !== '00:00:00:00:00:00' && !net.internal) {
        mac = net.mac;
        break;
      }
    }
    if (mac) break;
  }
  const rawSeed = `${os.hostname()}|${os.platform()}|${os.arch()}|${cpuModel}|${mac || 'NO_MAC'}`;
  const hash = crypto.createHash('sha256').update(rawSeed).digest('hex').toUpperCase();
  return `LNX-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}

/**
 * Verifica se a senha master informada é válida
 */
export function verifyMasterPassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.trim() === getMasterPassword();
}

/**
 * Gera assinatura HMAC-SHA256 para os dados da licença
 */
function createSignature(cnpj, machineId, validUntil, maxFiliais, planType) {
  const payload = `${cnpj.replace(/\D/g, '')}|${machineId}|${validUntil}|${maxFiliais}|${planType}`;
  return crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex').slice(0, 12).toUpperCase();
}

/**
 * Gera uma Chave de Licença Criptográfica (para o dono da empresa emitir ao cliente)
 */
export function generateLicenseKey({
  cnpj,
  machineId,
  days = 30,
  maxFiliais = 1,
  planType = 'mensal'
}) {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '') || '00000000000000';
  const mId = String(machineId || '').trim().toUpperCase() || 'LNX-ANY-MACH';
  
  const now = new Date();
  const expDate = new Date(now.getTime() + Number(days) * 86400 * 1000);
  const validUntil = expDate.toISOString().slice(0, 10);
  const issuedAt = now.toISOString().slice(0, 10);

  const sig = createSignature(cleanCnpj, mId, validUntil, maxFiliais, planType);
  const ymd = validUntil.replace(/-/g, '');
  const cnpjBlock = cleanCnpj.slice(0, 6).padEnd(6, '0');

  // Formato: LIC-071056-20261215-A1B2-C3D4-E5F6
  const licenseKey = `LIC-${cnpjBlock}-${ymd}-${sig.slice(0, 4)}-${sig.slice(4, 8)}-${sig.slice(8, 12)}`;

  return {
    ok: true,
    licenseKey,
    validUntil,
    issuedAt,
    days: Number(days),
    cnpj: cleanCnpj,
    machineId: mId,
    maxFiliais: Number(maxFiliais),
    planType
  };
}

/**
 * Valida uma chave de licença contra o CNPJ e o Hardware ID
 */
export function validateLicenseKeyString(licenseKey, expectedCnpj, currentMachineId = null) {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { valid: false, error: 'Chave de licença vazia ou inválida.' };
  }

  const parts = licenseKey.trim().toUpperCase().split('-');
  if (parts.length !== 6 || parts[0] !== 'LIC') {
    return { valid: false, error: 'Formato da chave inválido. Esperado padrão LIC-XXXXXX-AAAAMMDD-XXXX-XXXX-XXXX' };
  }

  const [, cnpjBlock, ymd, sig1, sig2, sig3] = parts;
  if (!/^\d{8}$/.test(ymd)) {
    return { valid: false, error: 'Data de expiração corrompida na chave.' };
  }

  const year = ymd.slice(0, 4);
  const month = ymd.slice(4, 6);
  const day = ymd.slice(6, 8);
  const validUntil = `${year}-${month}-${day}`;

  const providedSig = `${sig1}${sig2}${sig3}`;
  const cleanCnpj = String(expectedCnpj || '').replace(/\D/g, '') || '00000000000000';
  const mId = currentMachineId ? currentMachineId.trim().toUpperCase() : getMachineFingerprint();

  // Teste de assinaturas com suporte a múltiplos tipos de planos e chave curinga de máquina
  const candidatePlans = ['mensal', 'degustacao_piloto', 'degustacao', 'anual', 'trimestral', 'semestral', 'vitalicio', 'enterprise'];
  const candidateMachines = [mId, 'LNX-ANY-MACH'];
  const candidateFiliais = [1, 2, 3, 5, 10, 99];

  let matched = false;
  for (const plan of candidatePlans) {
    for (const mach of candidateMachines) {
      for (const fil of candidateFiliais) {
        if (createSignature(cleanCnpj, mach, validUntil, fil, plan) === providedSig) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) break;
  }

  if (!matched) {
    return { valid: false, error: 'Assinatura criptográfica inválida para este CNPJ ou Máquina.' };
  }

  // Verifica data de expiração
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = validUntil < today;
  const diffTime = new Date(validUntil).getTime() - new Date(today).getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 86400)));

  return {
    valid: true,
    isExpired,
    daysRemaining,
    validUntil,
    cnpj: cleanCnpj,
    machineId: mId
  };
}

/**
 * Retorna o status atual da licença do cliente
 */
export function getClientLicenseStatus(clientCode = 'bandeirante') {
  ensureLicenseTable();
  const db = getAnalyticsDb();
  const profile = getClientProfile(clientCode) || {};
  const currentMachineId = getMachineFingerprint();

  const licRow = db
    .prepare('SELECT * FROM system_licenses WHERE client_code = ? ORDER BY id DESC LIMIT 1')
    .get(clientCode);

  const cleanCnpj = String(profile.buyer_cnpj || '').replace(/\D/g, '');
  const today = new Date().toISOString().slice(0, 10);

  if (!licRow) {
    // Licença inicial de cortesia / degustação de 30 dias na primeira instalação
    const initialKey = generateLicenseKey({
      cnpj: cleanCnpj || '00000000000000',
      machineId: currentMachineId,
      days: 30,
      maxFiliais: 1,
      planType: 'degustacao_piloto'
    });

    db.prepare(`
      INSERT INTO system_licenses (
        client_code, cnpj, machine_id, license_key, issued_at, valid_until,
        plan_type, max_filiais, status, activated_at, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now', 'localtime'), ?)
    `).run(
      clientCode,
      initialKey.cnpj,
      initialKey.machineId,
      initialKey.licenseKey,
      initialKey.issuedAt,
      initialKey.validUntil,
      initialKey.planType,
      initialKey.maxFiliais,
      initialKey.licenseKey
    );

    return {
      isValid: true,
      isExpired: false,
      daysRemaining: 30,
      validUntil: initialKey.validUntil,
      planType: 'degustacao_piloto',
      machineId: currentMachineId,
      cnpj: cleanCnpj,
      clientName: profile.name || 'Farmácia Piloto',
      licenseKey: initialKey.licenseKey
    };
  }

  // Validação estrita da licença gravada
  const valRes = validateLicenseKeyString(licRow.license_key, licRow.cnpj || cleanCnpj, licRow.machine_id);

  const isExpired = valRes.isExpired || licRow.valid_until < today;
  const diffTime = new Date(licRow.valid_until).getTime() - new Date(today).getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 86400)));

  return {
    isValid: valRes.valid && !isExpired,
    isExpired,
    daysRemaining,
    validUntil: licRow.valid_until,
    planType: licRow.plan_type || 'mensal',
    machineId: currentMachineId,
    licensedMachineId: licRow.machine_id,
    cnpj: licRow.cnpj,
    clientName: profile.name || 'Farmácia Cliente',
    licenseKey: licRow.license_key,
    status: isExpired ? 'EXPIRED' : 'ACTIVE'
  };
}

/**
 * Ativa uma nova chave mensal informada pelo cliente
 */
export function activateLicenseKey(clientCode = 'bandeirante', licenseKey) {
  ensureLicenseTable();
  const db = getAnalyticsDb();
  const profile = getClientProfile(clientCode) || {};
  const currentMachineId = getMachineFingerprint();

  // Buscar a última licença ativa ou gerada para o cliente
  const lastLic = db
    .prepare('SELECT cnpj FROM system_licenses WHERE client_code = ? ORDER BY id DESC LIMIT 1')
    .get(clientCode);

  // Lista de CNPJs candidatos para validação flexível e robusta
  const candidateCnpjs = new Set();
  if (profile.buyer_cnpj) candidateCnpjs.add(String(profile.buyer_cnpj).replace(/\D/g, ''));
  if (lastLic?.cnpj) candidateCnpjs.add(String(lastLic.cnpj).replace(/\D/g, ''));
  candidateCnpjs.add('00000000000000'); // Base inicial recém-instalada
  candidateCnpjs.add('07105688000113'); // Drogaria Bom Jesus (CNPJ oficial da loja)
  candidateCnpjs.add('28660206000167'); // CNPJ matriz / oficial exibido no portal de licenciamento

  try {
    const allProfiles = db.prepare('SELECT buyer_cnpj FROM client_profiles WHERE buyer_cnpj IS NOT NULL').all();
    for (const p of allProfiles) {
      if (p.buyer_cnpj) candidateCnpjs.add(String(p.buyer_cnpj).replace(/\D/g, ''));
    }
  } catch {}

  let valRes = { valid: false, error: 'Chave de licença inválida.' };

  for (const candidate of candidateCnpjs) {
    if (!candidate) continue;
    const testRes = validateLicenseKeyString(licenseKey, candidate, currentMachineId);
    if (testRes.valid) {
      valRes = testRes;
      break;
    }
  }

  if (!valRes.valid) {
    throw new Error(valRes.error || 'Assinatura criptográfica inválida para este CNPJ ou Máquina.');
  }

  if (valRes.isExpired) {
    throw new Error(`Esta chave de licença já está expirada (venceu em ${valRes.validUntil}).`);
  }

  db.prepare(`
    INSERT INTO system_licenses (
      client_code, cnpj, machine_id, license_key, issued_at, valid_until,
      plan_type, max_filiais, status, activated_at, signature
    ) VALUES (?, ?, ?, ?, date('now'), ?, 'mensal', 1, 'ACTIVE', datetime('now', 'localtime'), ?)
  `).run(
    clientCode,
    valRes.cnpj,
    valRes.machineId,
    licenseKey.trim().toUpperCase(),
    valRes.validUntil,
    licenseKey.trim().toUpperCase()
  );

  // Sincroniza o buyer_cnpj em client_profiles com o CNPJ ativado
  if (valRes.cnpj && valRes.cnpj.length === 14) {
    db.prepare('UPDATE client_profiles SET buyer_cnpj = ? WHERE code = ?').run(valRes.cnpj, clientCode);
  }

  return {
    ok: true,
    message: `✓ Assinatura ativada com sucesso! Válida até ${valRes.validUntil} (${valRes.daysRemaining} dias restantes).`,
    validUntil: valRes.validUntil,
    daysRemaining: valRes.daysRemaining,
    machineId: valRes.machineId,
    cnpj: valRes.cnpj,
    planType: 'mensal'
  };
}

/**
 * Registra uma chave emitida no livro de controle do dono (ledger)
 */
export function recordIssuedLicense({
  clientName,
  cnpj,
  machineId,
  contactPhone = '',
  monthlyPrice = 0,
  planType = 'mensal',
  days = 30,
  licenseKey,
  validUntil,
  notes = '',
}) {
  ensureLicenseTable();
  const db = getAnalyticsDb();
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');

  const info = db.prepare(`
    INSERT INTO issued_licenses_ledger (
      client_name, cnpj, machine_id, contact_phone, monthly_price, plan_type,
      days, license_key, issued_at, valid_until, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?, 'ACTIVE', ?)
  `).run(
    clientName || 'Cliente Farmácia',
    cleanCnpj,
    machineId || 'LNX-ANY-MACH',
    contactPhone || '',
    Number(monthlyPrice || 0),
    planType,
    Number(days),
    licenseKey,
    validUntil,
    notes || ''
  );

  return { ok: true, id: info.lastInsertRowid };
}

/**
 * Lista todas as licenças geradas para controle de cobrança e vencimentos
 */
export function listIssuedLicenses() {
  ensureLicenseTable();
  const db = getAnalyticsDb();
  const rows = db.prepare(`
    SELECT * FROM issued_licenses_ledger
    ORDER BY valid_until ASC, id DESC
  `).all();

  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    const isExpired = r.valid_until < today;
    const diff = new Date(r.valid_until).getTime() - new Date(today).getTime();
    const daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 86400)));
    return {
      ...r,
      isExpired,
      daysRemaining,
      status: isExpired ? 'EXPIRED' : (daysRemaining <= 5 ? 'EXPIRING' : 'ACTIVE')
    };
  });
}

/**
 * Remove um registro de licença do livro de controle do dono
 */
export function deleteIssuedLicense(id) {
  ensureLicenseTable();
  const db = getAnalyticsDb();
  db.prepare('DELETE FROM issued_licenses_ledger WHERE id = ?').run(Number(id));
  return { ok: true };
}
