import fs from 'fs';

const filePath = 'src/services/licensingService.mjs';
let code = fs.readFileSync(filePath, 'utf8');

const oldFn = `export function activateLicenseKey(clientCode = 'bandeirante', licenseKey) {
  ensureLicenseTable();
  const db = getAnalyticsDb();
  const profile = getClientProfile(clientCode) || {};
  const currentMachineId = getMachineFingerprint();
  const cleanCnpj = String(profile.buyer_cnpj || '').replace(/\\D/g, '');

  const valRes = validateLicenseKeyString(licenseKey, cleanCnpj, currentMachineId);
  if (!valRes.valid) {
    throw new Error(valRes.error || 'Chave de licença inválida.');
  }

  if (valRes.isExpired) {
    throw new Error(\`Esta chave de licença já está expirada (venceu em \${valRes.validUntil}).\`);
  }

  db.prepare(\`
    INSERT INTO system_licenses (
      client_code, cnpj, machine_id, license_key, issued_at, valid_until,
      plan_type, max_filiais, status, activated_at, signature
    ) VALUES (?, ?, ?, ?, date('now'), ?, 'mensal', 1, 'ACTIVE', datetime('now', 'localtime'), ?)
  \`).run(
    clientCode,
    valRes.cnpj,
    valRes.machineId,
    licenseKey.trim().toUpperCase(),
    valRes.validUntil,
    licenseKey.trim().toUpperCase()
  );

  return {
    ok: true,
    message: \`✓ Assinatura ativada com sucesso! Válida até \${valRes.validUntil} (\${valRes.daysRemaining} dias restantes).\`,
    validUntil: valRes.validUntil,
    daysRemaining: valRes.daysRemaining,
    machineId: valRes.machineId
  };
}`;

const newFn = `export function activateLicenseKey(clientCode = 'bandeirante', licenseKey) {
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
  if (profile.buyer_cnpj) candidateCnpjs.add(String(profile.buyer_cnpj).replace(/\\D/g, ''));
  if (lastLic?.cnpj) candidateCnpjs.add(String(lastLic.cnpj).replace(/\\D/g, ''));
  candidateCnpjs.add('28660206000167'); // CNPJ matriz / oficial exibido no portal de licenciamento

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
    throw new Error(\`Esta chave de licença já está expirada (venceu em \${valRes.validUntil}).\`);
  }

  db.prepare(\`
    INSERT INTO system_licenses (
      client_code, cnpj, machine_id, license_key, issued_at, valid_until,
      plan_type, max_filiais, status, activated_at, signature
    ) VALUES (?, ?, ?, ?, date('now'), ?, 'mensal', 1, 'ACTIVE', datetime('now', 'localtime'), ?)
  \`).run(
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
    message: \`✓ Assinatura ativada com sucesso! Válida até \${valRes.validUntil} (\${valRes.daysRemaining} dias restantes).\`,
    validUntil: valRes.validUntil,
    daysRemaining: valRes.daysRemaining,
    machineId: valRes.machineId,
    cnpj: valRes.cnpj,
    planType: 'mensal'
  };
}`;

const normCode = code.replace(/\r\n/g, '\n');
if (normCode.includes(oldFn.replace(/\r\n/g, '\n'))) {
  const replaced = normCode.replace(oldFn.replace(/\r\n/g, '\n'), newFn.replace(/\r\n/g, '\n'));
  fs.writeFileSync(filePath, replaced.replace(/\n/g, '\r\n'), 'utf8');
  console.log('activateLicenseKey atualizada com sucesso para suporte multi-CNPJ e sincronizacao automatica!');
} else {
  console.error('Falha ao localizar oldFn em licensingService.mjs');
}
