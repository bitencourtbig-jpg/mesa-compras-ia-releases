import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_OWNER = 'bitencourtbig-jpg';
const REPO_NAME = 'mesa-compras-ia-releases';

const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const rawArg = process.argv[2] || pkgJson.version || '1.2.3';
const versionClean = rawArg.replace(/^v/, '');
const TAG = `v${versionClean}`;
const RELEASE_NAME = `Mesa de Compras IA ${TAG} • Versão Oficial`;

console.log('======================================================================');
console.log(`🚀 UPLOAD AUTOMÁTICO DE RELEASE PARA O GITHUB • ${TAG}`);
console.log(`   Repositório: ${REPO_OWNER}/${REPO_NAME}`);
console.log('======================================================================\n');

// 1. Obter Token via Git Credential Manager
function getGitHubToken() {
  return new Promise((resolve, reject) => {
    const p = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'inherit'] });
    p.stdin.write('protocol=https\nhost=github.com\n\n');
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error('Falha ao obter credenciais do Git.'));
      const line = out.split('\n').find((l) => l.startsWith('password='));
      if (!line) return reject(new Error('Token do GitHub não encontrado no Git Credential Manager.'));
      resolve(line.split('=')[1].trim());
    });
  });
}

// 2. Upload de arquivo binário para a Release
async function uploadAsset(uploadUrlRaw, filePath, fileName, mimeType, token) {
  const uploadUrl = uploadUrlRaw.replace(/\{(\?name,label|\?name)\}/, `?name=${encodeURIComponent(fileName)}`);
  const fileStats = fs.statSync(filePath);
  const fileBytes = fs.readFileSync(filePath);
  const sizeMb = (fileStats.size / 1024 / 1024).toFixed(2);

  console.log(`[*] Enviando ${fileName} (${sizeMb} MB) para a Release...`);

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': mimeType,
      'Content-Length': String(fileStats.size),
      'User-Agent': 'MesaComprasIA-Uploader',
    },
    body: fileBytes,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao enviar ${fileName} (HTTP ${res.status}): ${errText}`);
  }

  const asset = await res.json();
  console.log(`  ✓ ${fileName} enviado com sucesso! URL: ${asset.browser_download_url}`);
  return asset;
}

async function main() {
  try {
    console.log('[1/4] Recuperando credenciais seguras do GitHub Desktop...');
    const token = await getGitHubToken();
    console.log('  ✓ Autenticado com sucesso via Git Credential Manager.\n');

    // 2. Verificar ou Criar Release no GitHub
    console.log(`[2/4] Verificando existência da release ${TAG} no GitHub...`);
    const releasesUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'MesaComprasIA-Uploader',
    };

    let release = null;
    const listRes = await fetch(releasesUrl, { headers });
    if (listRes.ok) {
      const releases = await listRes.json();
      release = releases.find((r) => r.tag_name === TAG);
    }

    if (!release) {
      console.log(`  -> Criando nova Release no GitHub (${TAG})...`);
      const createRes = await fetch(releasesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tag_name: TAG,
          name: RELEASE_NAME,
          body: `Versão oficial de produção ${TAG} da Mesa de Compras IA (FSConsultoria).\n\n- Remanejamento Multi-Loja Inteligente com Cockpit dedicado e status em tempo real\n- Auditoria cruzada de trânsito (NFe faturadas pendentes, pedidos em aberto no BIG e guias ativas)\n- Detecção de risco de duplicidade de compras com badges visuais e popover analítico detalhado\n- Colunas completas de auditoria de estoque (Origem, Mín/Máx Origem, Destino, Trânsito)\n- Exportação Excel (.xlsx) profissional para remanejamento com formatação executiva e assinatura\n- Consolidação automática e unificação inteligente de guias de transferência duplicadas\n- Otimizações de performance no motor de compras e banco analítico local`,
          draft: false,
          prerelease: false,
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Falha ao criar release: ${await createRes.text()}`);
      }
      release = await createRes.json();
      console.log(`  ✓ Release criada com sucesso! (ID: ${release.id})`);
    } else {
      console.log(`  ✓ Release existente encontrada: ${release.name} (ID: ${release.id})`);
    }

    // 3. Remover assets antigos se existirem para permitir sobrescrita limpa
    console.log('\n[3/4] Verificando e limpando assets anteriores...');
    const currentAssets = release.assets || [];
    const filesToUpload = [
      {
        path: path.resolve(ROOT, '..', 'Entrega_Mesa_Compras_IA', 'Mesa_Compras_IA_Core.zip'),
        name: 'Mesa_Compras_IA_Core.zip',
        mime: 'application/zip',
      },
      {
        path: path.resolve(ROOT, '..', 'Entrega_Mesa_Compras_IA', 'Instalador_Mesa_Compras_IA.exe'),
        name: 'Instalador_Mesa_Compras_IA.exe',
        mime: 'application/octet-stream',
      },
      {
        path: path.resolve(ROOT, '..', 'Entrega_Mesa_Compras_IA', 'Atualizar_Mesa_Compras_IA.exe'),
        name: 'Atualizar_Mesa_Compras_IA.exe',
        mime: 'application/octet-stream',
      },
    ];

    for (const target of filesToUpload) {
      const existing = currentAssets.find((a) => a.name === target.name);
      if (existing) {
        console.log(`  -> Removendo asset antigo ${target.name} (ID: ${existing.id})...`);
        await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${existing.id}`, {
          method: 'DELETE',
          headers,
        });
      }
    }

    // 4. Fazer upload dos novos arquivos
    console.log('\n[4/4] Fazendo upload dos arquivos para a Release oficial no GitHub...');
    for (const target of filesToUpload) {
      if (fs.existsSync(target.path)) {
        await uploadAsset(release.upload_url, target.path, target.name, target.mime, token);
      } else {
        console.warn(`  ⚠️ Arquivo não encontrado para upload: ${target.path}`);
      }
    }

    console.log('\n======================================================================');
    console.log(`✓ RELEASE ${TAG} ATUALIZADA E PUBLICADA COM TOTAL SUCESSO NO GITHUB!`);
    console.log(`  URL Permanente: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/Mesa_Compras_IA_Core.zip`);
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n[ERRO NO UPLOAD AUTOMÁTICO]', err.message);
    process.exit(1);
  }
}

main();
