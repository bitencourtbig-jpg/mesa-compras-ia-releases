import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_BASE = path.resolve(ROOT, '..', 'dist_cliente');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version || '1.0.1';

const UPDATE_DIR = path.join(DIST_BASE, `BIG_Compras_AI_Update_v${VERSION}`);
const ZIP_DEST = path.join(DIST_BASE, `BIG_Compras_AI_Update_v${VERSION}.zip`);

console.log('================================================================');
console.log(`📦 GERANDO PACOTE LEVE DE ATUALIZAÇÃO (PATCH v${VERSION})`);
console.log('   Destino: ' + UPDATE_DIR);
console.log('================================================================\n');

// 1. Limpar / Criar pasta temporária do pacote de update
if (fs.existsSync(UPDATE_DIR)) {
  fs.rmSync(UPDATE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(UPDATE_DIR, { recursive: true });

// 2. Função de cópia recursiva seletiva
function copyFolderSync(src, dest, filterFn = () => true) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (!filterFn(srcPath, entry.name)) continue;
    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copiar apenas os arquivos de aplicação atualizados (src, public, lib, db, assets)
console.log('[1/4] Copiando código-fonte e interfaces atualizadas...');
copyFolderSync(path.join(ROOT, 'src'), path.join(UPDATE_DIR, 'src'));
copyFolderSync(path.join(ROOT, 'public'), path.join(UPDATE_DIR, 'public'), (p, name) => {
  return !name.includes('gerador');
});
copyFolderSync(path.join(ROOT, 'lib'), path.join(UPDATE_DIR, 'lib'));
copyFolderSync(path.join(ROOT, 'db'), path.join(UPDATE_DIR, 'db'));
copyFolderSync(path.join(ROOT, 'assets'), path.join(UPDATE_DIR, 'assets'));
fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(UPDATE_DIR, 'package.json'));

// 4. Criar o script de atualização segura no cliente (atualizar_sistema.bat)
console.log('[2/4] Criando script de atualização automática com backup de segurança...');
const batAtualizar = `@echo off
chcp 65001 > nul
title Atualizador Automático • BIG Compras AI v${VERSION}
color 0B
cls
echo ======================================================================
echo    ATUALIZADOR AUTOMÁTICO • BIG COMPRAS AI (VERSÃO ${VERSION})
echo ======================================================================
echo.
echo Este utilitário aplica as novas melhorias no sistema preservando
echo 100% da sua Chave de Licença, configurações de banco e histórico.
echo.

cd /d "%~dp0"

echo [*] Passo 1/4: Encerrando servidor local em execução...
powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*BIG_Compras_AI*' } | Stop-Process -Force" 2>nul
timeout /t 1 > nul

echo [*] Passo 2/4: Criando backup de segurança das configurações e licença...
if not exist "backups_atualizacao" mkdir backups_atualizacao
set BACKUP_FOLDER=backups_atualizacao\\backup_pre_v${VERSION}_%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%
set BACKUP_FOLDER=%BACKUP_FOLDER: =0%
mkdir "%BACKUP_FOLDER%" 2>nul

if exist ".env" copy /Y ".env" "%BACKUP_FOLDER%\\.env" > nul
if exist "data\\analytics.db" copy /Y "data\\analytics.db" "%BACKUP_FOLDER%\\analytics.db" > nul
echo     ✓ Backup concluído com sucesso em: %BACKUP_FOLDER%

echo [*] Passo 3/4: Aplicando novos arquivos de sistema (v${VERSION})...
:: Copia recursiva das novas pastas sobrescrevendo apenas código
xcopy /E /Y /I "patch_files\\src" "src" > nul
xcopy /E /Y /I "patch_files\\public" "public" > nul
xcopy /E /Y /I "patch_files\\lib" "lib" > nul
xcopy /E /Y /I "patch_files\\db" "db" > nul
if exist "patch_files\\assets" xcopy /E /Y /I "patch_files\\assets" "assets" > nul
copy /Y "patch_files\\package.json" "package.json" > nul

echo     ✓ Arquivos atualizados com sucesso!

echo [*] Passo 4/4: Reiniciando o sistema com as novas melhorias...
if exist "iniciar_sistema.vbs" (
    wscript "iniciar_sistema.vbs"
) else if exist "iniciar_sistema.bat" (
    start "" "iniciar_sistema.bat"
) else (
    echo Abra o sistema normalmente pelo atalho da Área de Trabalho.
)

echo.
echo ======================================================================
echo   ✓ SUCESSO! O BIG COMPRAS AI FOI ATUALIZADO PARA A VERSÃO ${VERSION}!
echo   
echo   Suas configurações de banco e licença foram mantidas intactas.
echo ======================================================================
echo.
pause
`;

// Vamos organizar o pacote com:
//  - atualizar_sistema.bat (na raiz)
//  - patch_files/ (src, public, lib, db, package.json)
const patchDir = path.join(UPDATE_DIR, 'patch_files');
fs.mkdirSync(patchDir, { recursive: true });

// Move as pastas para dentro de patch_files
for (const item of ['src', 'public', 'lib', 'db', 'assets', 'package.json']) {
  const src = path.join(UPDATE_DIR, item);
  const dest = path.join(patchDir, item);
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest);
  }
}

fs.writeFileSync(path.join(UPDATE_DIR, 'atualizar_sistema.bat'), batAtualizar, 'utf8');

const docLeiaMe = `======================================================================
  ATUALIZAÇÃO OFICIAL • BIG COMPRAS AI (VERSÃO ${VERSION})
======================================================================

COMO APLICAR A ATUALIZAÇÃO NO CLIENTE:

1. Extraia o conteúdo deste arquivo ZIP diretamente dentro da pasta onde
   o BIG Compras AI está instalado na farmácia (ex: C:\\BIG_Compras_AI).

2. Dê dois cliques em: atualizar_sistema.bat

3. O atualizador faz tudo automaticamente em 3 segundos:
   - Faz backup de segurança do seu banco e configurações;
   - Atualiza os arquivos do sistema para a versão ${VERSION};
   - Reinicia o sistema e abre a tela no navegador com as novas melhorias!

NOTAS:
- A sua Senha Master, conexões de banco e licença mensal NÃO são apagadas.
- Em caso de dúvidas, contate o suporte técnico.
======================================================================
`;
fs.writeFileSync(path.join(UPDATE_DIR, 'LEIA_ME_ATUALIZACAO.txt'), docLeiaMe, 'utf8');

// 5. Compactar em ZIP leve usando tar
console.log('[3/4] Compactando pacote de atualização leve em ZIP...');
try {
  execSync(`tar -a -c -f "${ZIP_DEST}" -C "${DIST_BASE}" "BIG_Compras_AI_Update_v${VERSION}"`, { stdio: 'inherit' });
  const stat = fs.statSync(ZIP_DEST);
  const mb = (stat.size / 1024 / 1024).toFixed(2);
  console.log(`[4/4] ✓ Pacote ZIP gerado com sucesso: ${ZIP_DEST} (${mb} MB)`);
} catch (err) {
  console.warn('Aviso ao gerar ZIP:', err.message);
}

console.log('\n================================================================');
console.log(`✓ PROCESSO CONCLUÍDO! O PATCH v${VERSION} ESTÁ PRONTO PARA ENVIO AOS CLIENTES.`);
console.log('================================================================\n');
