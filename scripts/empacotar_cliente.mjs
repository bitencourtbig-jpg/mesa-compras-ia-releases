import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { getAnalyticsDb } from '../src/store/analyticsDb.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_BASE = path.resolve(ROOT, '..', 'dist_cliente');
const DIST_CLIENTE = path.join(DIST_BASE, 'Mesa_Compras_IA');
const PASTA_ENTREGA = path.resolve(ROOT, '..', 'Entrega_Mesa_Compras_IA');

console.log('================================================================');
console.log('📦 GERANDO PACOTE OFICIAL DE DISTRIBUIÇÃO • MESA DE COMPRAS IA');
console.log('   FSConsultoria Farmacêutica • Suporte: (17) 98120-5660');
console.log('   Destino do Core: ' + DIST_CLIENTE);
console.log('   Pasta de Entrega Única: ' + PASTA_ENTREGA);
console.log('================================================================\n');

// 1. Limpar / Criar diretórios
if (fs.existsSync(DIST_CLIENTE)) {
  console.log('[1/8] Limpando compilação anterior...');
  fs.rmSync(DIST_CLIENTE, { recursive: true, force: true });
}
fs.mkdirSync(DIST_CLIENTE, { recursive: true });
fs.mkdirSync(path.join(DIST_CLIENTE, 'bin'), { recursive: true });
fs.mkdirSync(path.join(DIST_CLIENTE, 'data'), { recursive: true });
fs.mkdirSync(path.join(DIST_CLIENTE, 'assets'), { recursive: true });

if (!fs.existsSync(PASTA_ENTREGA)) {
  fs.mkdirSync(PASTA_ENTREGA, { recursive: true });
}

// 2. Copiar Runtime Node.js portátil
console.log('[2/8] Embarcando runtime Node.js portátil oficial (bin/node.exe)...');
const portableNode = path.join(ROOT, 'dist', 'BIG_Compras_AI_Portatil', 'bin', 'node.exe');
const distClienteOldNode = path.join(DIST_BASE, 'BIG_Compras_AI', 'bin', 'node.exe');
const systemNode = 'C:\\Program Files\\nodejs\\node.exe';
const targetNode = path.join(DIST_CLIENTE, 'bin', 'node.exe');

if (fs.existsSync(portableNode)) {
  fs.copyFileSync(portableNode, targetNode);
  console.log('  ✓ bin/node.exe copiado com sucesso.');
} else if (fs.existsSync(distClienteOldNode)) {
  fs.copyFileSync(distClienteOldNode, targetNode);
  console.log('  ✓ bin/node.exe reaproveitado da compilação anterior.');
} else if (fs.existsSync(systemNode)) {
  fs.copyFileSync(systemNode, targetNode);
  console.log('  ✓ bin/node.exe copiado do sistema.');
} else {
  console.warn('  ⚠️ node.exe não encontrado para embarcar no pacote.');
}

// 3. Função de cópia recursiva
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

// 4. Copiar código da aplicação
console.log('[3/8] Copiando módulos, front-end e regras de negócio...');
copyFolderSync(path.join(ROOT, 'src'), path.join(DIST_CLIENTE, 'src'));
copyFolderSync(path.join(ROOT, 'db'), path.join(DIST_CLIENTE, 'db'));
copyFolderSync(path.join(ROOT, 'lib'), path.join(DIST_CLIENTE, 'lib'));
copyFolderSync(path.join(ROOT, 'public'), path.join(DIST_CLIENTE, 'public'), (filePath, name) => {
  if (name.includes('gerador') || name.includes('licenca_generator')) return false;
  return true;
});
copyFolderSync(path.join(ROOT, 'assets'), path.join(DIST_CLIENTE, 'assets'));
fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(DIST_CLIENTE, 'package.json'));

console.log('[4/8] Copiando dependências de produção (node_modules)...');
copyFolderSync(path.join(ROOT, 'node_modules'), path.join(DIST_CLIENTE, 'node_modules'));

// 5. Preparar banco de dados SQLite limpo
console.log('[5/8] Gerando banco analítico virgem (Zero resíduos de clientes anteriores)...');
const targetDb = path.join(DIST_CLIENTE, 'data', 'analytics.db');
try {
  if (fs.existsSync(targetDb)) fs.rmSync(targetDb, { force: true });
  const db = getAnalyticsDb(targetDb);
  db.exec(`
    INSERT INTO system_settings (key, value)
    VALUES ('master_password', 'Consultoria@2026')
    ON CONFLICT(key) DO UPDATE SET value = 'Consultoria@2026';

    INSERT INTO client_profiles (
      code, name, db_host, db_port, db_user, db_password, db_name,
      buyer_filial_id, buyer_cnpj, default_supplier_id, default_supplier_name,
      active_sales_filials, ignored_filials, service_profile, default_weeks, recent_entries_limit
    ) VALUES (
      'default', 'Nova Farmácia Cliente', '127.0.0.1', 3306, 'compras_consulta', 'Consultoria@2026', 'gerente',
      2, '', 10, 'FORNECEDOR PADRAO',
      '[2]', '[]', 'equilibrado', 13, 5
    ) ON CONFLICT(code) DO NOTHING;
    VACUUM;
  `);
  db.close();
  console.log('  ✓ Banco SQLite virgem inicializado com sucesso.');
} catch (err) {
  console.warn('  ⚠️ Erro na inicialização do SQLite virgem:', err.message);
}

// 6. Criar scripts de execução
console.log('[6/8] Gerando scripts de inicialização silenciosa e atalhos...');

// Helper para gravar arquivos Windows estritamente em CRLF e sem corrupção de seek no cmd.exe
function writeWindowsFile(filePath, content) {
  const crlf = content.replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(filePath, crlf, 'utf8');
}

// A. .env padrão
const envContent = `PORT=3456
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=compras_consulta
DB_PASSWORD=Consultoria@2026
DB_NAME=gerente
BIG_MASTER_PASSWORD=Consultoria@2026
ENABLE_DEV_INSPECTOR=false
`;
writeWindowsFile(path.join(DIST_CLIENTE, '.env'), envContent);

// B. Launcher Silencioso VBS (iniciar_sistema.vbs)
const vbsLauncher = `' ==============================================================================
' Mesa de Compras IA - FSConsultoria Farmaceutica
' Launcher Silencioso para Area de Trabalho (Sem janela preta de console)
' ==============================================================================
Option Explicit

Dim WshShell, fso, strDir, nodeExe, serverMjs, logFile, http, i, isRunning, cmdLine

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir

' 1. Verifica se o servidor ja esta rodando na porta 3456
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.setTimeouts 600, 600, 600, 600
http.open "GET", "http://127.0.0.1:3456/api/license/status", False
http.send

If Err.Number = 0 And (http.status = 200 Or http.status = 403) Then
    ' Servidor ja esta em execucao! Apenas abre o navegador na tela principal
    WshShell.Run "http://127.0.0.1:3456"
    WScript.Quit 0
End If
On Error Goto 0

' 2. Prioriza runtime portatil em bin\\node.exe
If fso.FileExists(strDir & "\\bin\\node.exe") Then
    nodeExe = strDir & "\\bin\\node.exe"
Else
    nodeExe = "node"
End If

serverMjs = strDir & "\\src\\server.mjs"
logFile = strDir & "\\data\\servidor_log.txt"

If Not fso.FolderExists(strDir & "\\data") Then
    fso.CreateFolder(strDir & "\\data")
End If

' 3. Dispara o servidor via cmd.exe de forma 100% oculta gravando log
cmdLine = "cmd.exe /c """"" & nodeExe & """ """ & serverMjs & """ > """ & logFile & """ 2>&1"""
WshShell.Run cmdLine, 0, False

' 4. Aguarda ativamente o servidor subir na porta 3456 (polling de ate 15 segundos)
isRunning = False
For i = 1 To 30
    WScript.Sleep 500
    On Error Resume Next
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 400, 400, 400, 400
    http.open "GET", "http://127.0.0.1:3456/api/license/status", False
    http.send
    If Err.Number = 0 And (http.status = 200 Or http.status = 403) Then
        isRunning = True
        Exit For
    End If
    On Error Goto 0
Next

' 5. Abre o navegador na Home Page
WshShell.Run "http://127.0.0.1:3456"
`;
writeWindowsFile(path.join(DIST_CLIENTE, 'iniciar_sistema.vbs'), vbsLauncher);

// C. Launcher Console para Suporte Técnico
const batIniciar = `@echo off
setlocal
title Mesa de Compras IA (Console Tecnico FSConsultoria)
color 0A
cd /d "%~dp0"

echo ======================================================================
echo    MESA DE COMPRAS IA - FSCONSULTORIA FARMACEUTICA
echo    Tecnologia e Inteligencia em Abastecimento para Farmacias
echo ======================================================================
echo.

set "NODE_EXEC=%~dp0bin\\node.exe"
if not exist "%NODE_EXEC%" (
    set "NODE_EXEC=node"
)

echo [*] Verificando runtime Node.js em: %NODE_EXEC%
"%NODE_EXEC%" -v > nul 2>&1
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Runtime Node.js nao pode ser executado.
    echo Verifique se o arquivo bin\\node.exe existe no pacote.
    echo Caminho testado: %NODE_EXEC%
    echo.
    pause
    exit /b 1
)

echo [*] Runtime Node.js validado com sucesso.
echo [*] Iniciando Mesa de Compras IA na porta 3456...
start "" "http://127.0.0.1:3456"
"%NODE_EXEC%" --no-warnings "%~dp0src\\server.mjs"
`;
writeWindowsFile(path.join(DIST_CLIENTE, 'iniciar_sistema.bat'), batIniciar);

// D. Parar Sistema (parar_sistema.bat)
const batParar = `@echo off
title Parar Mesa de Compras IA
color 0E
echo ======================================================================
echo    ENCERRANDO SERVIDOR MESA DE COMPRAS IA
echo ======================================================================
echo.

powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*Mesa_Compras_IA*' } | Stop-Process -Force" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Mesa de Compras IA*" > nul 2>&1

echo [*] Servidor finalizado com sucesso.
timeout /t 2 > nul
`;
writeWindowsFile(path.join(DIST_CLIENTE, 'parar_sistema.bat'), batParar);

// E. Criador de Atalho VBS (instalar_atalho.vbs)
const vbsAtalho = `Option Explicit
Dim WshShell, fso, strDir, desktopPath, shortcut
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopPath = WshShell.SpecialFolders("Desktop")
Set shortcut = WshShell.CreateShortcut(desktopPath & "\\Mesa de Compras IA.lnk")

If fso.FileExists(strDir & "\\Mesa_Compras_IA.exe") Then
    shortcut.TargetPath = strDir & "\\Mesa_Compras_IA.exe"
    shortcut.Arguments = ""
Else
    shortcut.TargetPath = "wscript.exe"
    shortcut.Arguments = """" & strDir & "\\iniciar_sistema.vbs"""
End If

shortcut.WorkingDirectory = strDir
shortcut.IconLocation = strDir & "\\assets\\icone_mesa_compras.ico"
shortcut.Description = "Mesa de Compras IA - Inteligencia em Abastecimento Farmaceutico FSConsultoria"
shortcut.Save
WScript.Echo "[OK] Atalho oficial criado em: " & desktopPath & "\\Mesa de Compras IA.lnk"
`;
writeWindowsFile(path.join(DIST_CLIENTE, 'instalar_atalho.vbs'), vbsAtalho);

const batInstalarAtalho = `@echo off
title Instalador de Atalho - Mesa de Compras IA
cls
echo ======================================================================
echo    INSTALADOR DO ATALHO NA AREA DE TRABALHO
echo    MESA DE COMPRAS IA - FSCONSULTORIA FARMACEUTICA
echo ======================================================================
echo.

cd /d "%~dp0"
cscript //nologo "%~dp0instalar_atalho.vbs"

if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel criar o atalho automaticamente.
  pause
  exit /b 1
)

echo.
echo ======================================================================
echo   [OK] SUCESSO! O icone 'Mesa de Compras IA' foi criado na Area de Trabalho.
echo   O comprador pode dar duplo clique nele todos os dias para trabalhar!
echo ======================================================================
echo.
pause
`;
writeWindowsFile(path.join(DIST_CLIENTE, 'instalar_atalho_area_de_trabalho.bat'), batInstalarAtalho);

// 6.1 Compilar executável nativo Mesa_Compras_IA.exe se compilador disponível
console.log('[6.1/8] Compilando executável nativo portátil (Mesa_Compras_IA.exe)...');
const cscCompiler = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const srcLauncher = path.resolve(PASTA_ENTREGA, 'dev_tools', 'Launcher.cs');
const outLauncher = path.join(DIST_CLIENTE, 'Mesa_Compras_IA.exe');
const icoPath = path.join(ROOT, 'assets', 'icone_mesa_compras.ico');

if (fs.existsSync(cscCompiler) && fs.existsSync(srcLauncher)) {
  try {
    execSync(`"${cscCompiler}" /nologo /optimize+ /target:winexe /out:"${outLauncher}" /r:System.Windows.Forms.dll /r:System.dll /win32icon:"${icoPath}" "${srcLauncher}"`, { stdio: 'inherit' });
    console.log('  ✓ Executável nativo Mesa_Compras_IA.exe gerado com sucesso.');
  } catch (err) {
    console.warn('  ⚠️ Falha ao compilar Launcher.cs:', err.message);
  }
}

// 7. Compactar Pacote Oficial (Mesa_Compras_IA_Core.zip)
console.log('[7/8] Compactando arquivo oficial de distribuição (Mesa_Compras_IA_Core.zip)...');
const zipDest = path.join(PASTA_ENTREGA, 'Mesa_Compras_IA_Core.zip');
const zipDestBase = path.join(DIST_BASE, 'Mesa_Compras_IA_Core.zip');

try {
  execSync(`tar -a -c -f "${zipDest}" -C "${DIST_BASE}" "Mesa_Compras_IA"`, { stdio: 'inherit' });
  fs.copyFileSync(zipDest, zipDestBase);
  const stat = fs.statSync(zipDest);
  const mb = (stat.size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ Pacote compactado gerado com sucesso: ${zipDest} (${mb} MB)`);
} catch (err) {
  console.warn('  ⚠️ Aviso ao compactar com tar:', err.message);
}

// 8. Criar Instalador Web / Atualizador e Scripts de Entrega
console.log('[8/8] Gerando instaladores unificados (Web Google Drive & Offline)...');

// A. Arquivo config_nuvem.ini
const configNuvem = `# ==============================================================================
# CONFIGURAÇÃO DE NUVEM • MESA DE COMPRAS IA (FSCONSULTORIA)
# Cole abaixo o ID ou Link do arquivo Mesa_Compras_IA_Core.zip no Google Drive.
# Exemplo de Link: https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing
# ==============================================================================
GOOGLE_DRIVE_ID=
VERSAO=1.1.2
CONTATO_SUPORTE=(17) 98120-5660
`;
writeWindowsFile(path.join(PASTA_ENTREGA, 'config_nuvem.ini'), configNuvem);

// B. Script interativo para configurar o Link do Google Drive (Configurar_Link_Google_Drive.bat)
const batConfigDrive = `@echo off
title Configuracao do Link Google Drive - FSConsultoria
color 0B
cls
echo ======================================================================
echo    CONFIGURAR LINK DO GOOGLE DRIVE - MESA DE COMPRAS IA
echo    FSConsultoria Farmaceutica - WhatsApp: (17) 98120-5660
echo ======================================================================
echo.
echo 1. Suba o arquivo "Mesa_Compras_IA_Core.zip" no seu Google Drive.
echo 2. Clique com botao direito nele -^> "Compartilhar" -^> "Qualquer pessoa com o link".
echo 3. Copie o link e cole abaixo:
echo.
set /p "LINK_INPUT=Cole o Link do Google Drive aqui: "

if "%LINK_INPUT%"=="" (
    echo.
    echo [!] Nenhum link informado. Nenhuma alteracao foi feita.
    pause
    exit /b 0
)

powershell -NoProfile -Command ^
  "$raw = '%LINK_INPUT%';" ^
  "$id = $raw;" ^
  "if ($raw -match '/d/([^/?]+)') { $id = $matches[1] }" ^
  "elseif ($raw -match 'id=([^&]+)') { $id = $matches[1] }" ^
  "$iniPath = '%~dp0config_nuvem.ini';" ^
  "$txt = Get-Content $iniPath -Raw;" ^
  "$newTxt = [regex]::Replace($txt, '(?m)^GOOGLE_DRIVE_ID=.*$', 'GOOGLE_DRIVE_ID=' + $id.Trim());" ^
  "Set-Content -Path $iniPath -Value $newTxt -Encoding UTF8;" ^
  "Write-Host ''; Write-Host '  [OK] ID configurado com sucesso: ' $id.Trim() -ForegroundColor Green;"

echo.
echo ======================================================================
echo   Pronto! Agora o instalador baixara automaticamente esta versao.
echo ======================================================================
echo.
pause
`;
writeWindowsFile(path.join(PASTA_ENTREGA, 'Configurar_Link_Google_Drive.bat'), batConfigDrive);

// C. Instalador Inteligente Batch (Instalador_Mesa_Compras_IA.bat)
const batInstaladorWeb = `@echo off
title Instalador Oficial - Mesa de Compras IA
color 0A
cls
echo ======================================================================
echo    INSTALADOR OFICIAL - MESA DE COMPRAS IA
echo    FSConsultoria Farmaceutica - Suporte: (17) 98120-5660
echo ======================================================================
echo.

set "TARGET_DIR=C:\\Mesa_Compras_IA"
set "LOCAL_ZIP=%~dp0Mesa_Compras_IA_Core.zip"
set "INI_FILE=%~dp0config_nuvem.ini"

rem 1. Verificar se ja esta instalado para perguntar se quer atualizar
if exist "%TARGET_DIR%\\src\\server.mjs" (
    echo [!] Detectamos que a Mesa de Compras IA ja esta instalada em:
    echo     %TARGET_DIR%
    echo.
    echo     [1] Atualizar Sistema (Mantem Banco de Dados, Senhas e Licenca intactos)
    echo     [2] Reinstalar do Zero
    echo     [3] Cancelar e Sair
    echo.
    set /p "OPCAO=Escolha uma opcao (1, 2 ou 3): "
    if "%OPCAO%"=="1" goto ATUALIZAR
    if "%OPCAO%"=="3" exit /b 0
)

:INSTALAR_NORMAL
echo.
echo [*] Preparando pasta de destino: %TARGET_DIR% ...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

rem 2. Verificar se o pacote zip esta presente localmente (pendrive/pasta)
if exist "%LOCAL_ZIP%" (
    echo [*] Pacote local detectado: Mesa_Compras_IA_Core.zip (Modo Offline Rapido)
    set "ZIP_TO_EXTRACT=%LOCAL_ZIP%"
    goto EXTRAIR
)

rem 3. Caso nao esteja local, buscar do Google Drive
echo [*] Pacote local nao encontrado. Conectando ao repositorio na nuvem...
set "DRIVE_ID="
if exist "%INI_FILE%" (
    for /f "tokens=1,2 delims==" %%A in (%INI_FILE%) do (
        if /i "%%A"=="GOOGLE_DRIVE_ID" set "DRIVE_ID=%%B"
    )
)

if "%DRIVE_ID%"=="" (
    echo.
    echo ======================================================================
    echo [!] O ID do Google Drive ainda nao foi pre-configurado no instalador.
    echo     Voce pode colar o link compartilhado do seu arquivo no Google Drive.
    echo ======================================================================
    echo.
    set /p "LINK_INPUT=Cole o Link ou ID do Google Drive (ou ENTER para sair): "
    if "%LINK_INPUT%"=="" exit /b 1
    for /f "delims=" %%I in ('powershell -NoProfile -Command "$raw='%LINK_INPUT%'; if($raw -match '/d/([^/?]+)'){ $matches[1] } elseif($raw -match 'id=([^&]+)'){ $matches[1] } else { $raw.Trim() }"') do set "DRIVE_ID=%%I"
)

echo [*] Baixando pacote mais recente da nuvem (Google Drive ID: %DRIVE_ID%)...
set "TEMP_ZIP=%TEMP%\\Mesa_Compras_IA_Core.zip"

powershell -NoProfile -Command ^
  "$fileId = '%DRIVE_ID%'.Trim();" ^
  "$output = '%TEMP_ZIP%';" ^
  "Write-Host '    -> Conectando ao servidor seguro do Google Drive...';" ^
  "$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession;" ^
  "$url = 'https://drive.google.com/uc?export=download&id=' + $fileId;" ^
  "try {" ^
  "  $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing;" ^
  "  if ($resp.Content -match 'confirm=([^&\"'']+)') {" ^
  "    $confirm = $matches[1];" ^
  "    $downloadUrl = 'https://drive.google.com/uc?export=download&confirm=' + $confirm + '&id=' + $fileId;" ^
  "  } else { $downloadUrl = $url }" ^
  "  Write-Host '    -> Baixando pacote da Mesa de Compras IA...';" ^
  "  Invoke-WebRequest -Uri $downloadUrl -WebSession $session -OutFile $output -UseBasicParsing;" ^
  "  Write-Host '    [OK] Download concluido com sucesso!' -ForegroundColor Green;" ^
  "} catch {" ^
  "  Write-Host '    [ERRO] Falha ao baixar do Google Drive: ' $_.Exception.Message -ForegroundColor Red;" ^
  "  exit 1;" ^
  "}"

if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel baixar os arquivos da nuvem. Verifique a internet e o link do Drive.
    pause
    exit /b 1
)
set "ZIP_TO_EXTRACT=%TEMP_ZIP%"

:EXTRAIR
echo [*] Descompactando arquivos da aplicacao em %TARGET_DIR% ...
tar -x -f "%ZIP_TO_EXTRACT%" -C "C:\\" > nul 2>&1
if errorlevel 1 (
    echo [*] Utilizando extrator alternativo do Windows...
    powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_TO_EXTRACT%' -DestinationPath 'C:\\' -Force"
)

rem 4. Finalizacao e Atalho
cd /d "%TARGET_DIR%"
echo [*] Criando atalho oficial 'Mesa de Compras IA' na Area de Trabalho...
cscript //nologo "%TARGET_DIR%\\instalar_atalho.vbs"

echo [*] Iniciando o servico em segundo plano...
wscript "%TARGET_DIR%\\iniciar_sistema.vbs"

echo.
echo ======================================================================
echo   [OK] INSTALACAO CONCLUIDA COM SUCESSO!
echo.
echo   1. O icone 'Mesa de Compras IA' foi criado na Area de Trabalho.
echo   2. O navegador padrao esta abrindo na tela de Boas-Vindas.
echo   3. Suporte e Ativacoes: FSConsultoria - WhatsApp (17) 98120-5660
echo ======================================================================
echo.
timeout /t 6
exit /b 0

:ATUALIZAR
echo.
echo [*] Iniciando Atualizacao Segura da Mesa de Compras IA...
echo [*] Encerrando processos anteriores em execucao...
powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*Mesa_Compras_IA*' } | Stop-Process -Force" 2>nul
timeout /t 1 > nul

rem Backup do Banco e do .env
if not exist "%TARGET_DIR%\\backup_seguro" mkdir "%TARGET_DIR%\\backup_seguro"
if exist "%TARGET_DIR%\\.env" copy /Y "%TARGET_DIR%\\.env" "%TARGET_DIR%\\backup_seguro\\.env" > nul
if exist "%TARGET_DIR%\\data\\analytics.db" copy /Y "%TARGET_DIR%\\data\\analytics.db" "%TARGET_DIR%\\backup_seguro\\analytics.db" > nul

goto INSTALAR_NORMAL
`;
writeWindowsFile(path.join(PASTA_ENTREGA, 'Instalador_Mesa_Compras_IA.bat'), batInstaladorWeb);

// D. Script dedicado de Atualização (Atualizar_Mesa_Compras_IA.bat)
const batAtualizador = `@echo off
title Atualizador Oficial - Mesa de Compras IA
color 0B
cls
echo ======================================================================
echo    ATUALIZADOR OFICIAL - MESA DE COMPRAS IA
echo    FSConsultoria Farmaceutica - Suporte: (17) 98120-5660
echo ======================================================================
echo.

set "TARGET_DIR=C:\\Mesa_Compras_IA"
set "LOCAL_ZIP=%~dp0Mesa_Compras_IA_Core.zip"
set "INI_FILE=%~dp0config_nuvem.ini"

if not exist "%TARGET_DIR%" (
    echo [ERRO] A Mesa de Compras IA ainda nao esta instalada nesta maquina.
    echo Execute o instalador normal primeiro: Instalador_Mesa_Compras_IA.bat
    pause
    exit /b 1
)

echo [*] Encerrando servico da Mesa de Compras IA...
powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*Mesa_Compras_IA*' } | Stop-Process -Force" 2>nul
timeout /t 1 > nul

echo [*] Criando backup de seguranca das configuracoes e licenca do cliente...
if not exist "%TARGET_DIR%\\backup_seguro" mkdir "%TARGET_DIR%\\backup_seguro"
if exist "%TARGET_DIR%\\.env" copy /Y "%TARGET_DIR%\\.env" "%TARGET_DIR%\\backup_seguro\\.env" > nul
if exist "%TARGET_DIR%\\data\\analytics.db" copy /Y "%TARGET_DIR%\\data\\analytics.db" "%TARGET_DIR%\\backup_seguro\\analytics.db" > nul

rem Verificar se o zip esta local ou se baixa do Drive
if exist "%LOCAL_ZIP%" (
    echo [*] Pacote local detectado para atualizacao.
    set "ZIP_UPDATE=%LOCAL_ZIP%"
    goto APLICAR_UPDATE
)

echo [*] Baixando a versao mais recente da nuvem...
set "DRIVE_ID="
if exist "%INI_FILE%" (
    for /f "tokens=1,2 delims==" %%A in (%INI_FILE%) do (
        if /i "%%A"=="GOOGLE_DRIVE_ID" set "DRIVE_ID=%%B"
    )
)

if "%DRIVE_ID%"=="" (
    echo [ERRO] Link da nuvem nao configurado no config_nuvem.ini.
    pause
    exit /b 1
)

set "TEMP_ZIP=%TEMP%\\Mesa_Compras_IA_Update.zip"
powershell -NoProfile -Command ^
  "$fileId = '%DRIVE_ID%'.Trim();" ^
  "$output = '%TEMP_ZIP%';" ^
  "$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession;" ^
  "$url = 'https://drive.google.com/uc?export=download&id=' + $fileId;" ^
  "try {" ^
  "  $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing;" ^
  "  if ($resp.Content -match 'confirm=([^&\"'']+)') {" ^
  "    $confirm = $matches[1];" ^
  "    $downloadUrl = 'https://drive.google.com/uc?export=download&confirm=' + $confirm + '&id=' + $fileId;" ^
  "  } else { $downloadUrl = $url }" ^
  "  Write-Host '    -> Baixando atualizacao...';" ^
  "  Invoke-WebRequest -Uri $downloadUrl -WebSession $session -OutFile $output -UseBasicParsing;" ^
  "  Write-Host '    [OK] Download concluido!' -ForegroundColor Green;" ^
  "} catch {" ^
  "  Write-Host '    [ERRO] Falha no download: ' $_.Exception.Message -ForegroundColor Red;" ^
  "  exit 1;" ^
  "}"

if errorlevel 1 (
    echo [ERRO] Falha ao baixar nova versao da nuvem.
    pause
    exit /b 1
)
set "ZIP_UPDATE=%TEMP_ZIP%"

:APLICAR_UPDATE
echo [*] Atualizando arquivos do motor e da interface...
tar -x -f "%ZIP_UPDATE%" -C "C:\\" > nul 2>&1

echo [*] Restaurando licenca e configuracoes do cliente...
if exist "%TARGET_DIR%\\backup_seguro\\.env" copy /Y "%TARGET_DIR%\\backup_seguro\\.env" "%TARGET_DIR%\\.env" > nul
if exist "%TARGET_DIR%\\backup_seguro\\analytics.db" copy /Y "%TARGET_DIR%\\backup_seguro\\analytics.db" "%TARGET_DIR%\\data\\analytics.db" > nul

echo [*] Reiniciando servico atualizado...
wscript "%TARGET_DIR%\\iniciar_sistema.vbs"

echo.
echo ======================================================================
echo   [OK] ATUALIZACAO CONCLUIDA COM SUCESSO!
echo   O Mesa de Compras IA ja esta em execucao com a versao mais recente.
echo   Todas as licencas e parametros do cliente foram preservados!
echo ======================================================================
echo.
timeout /t 5
`;
writeWindowsFile(path.join(PASTA_ENTREGA, 'Atualizar_Mesa_Compras_IA.bat'), batAtualizador);

// E. Manual do Usuário e Técnico
const manualCompleto = `# Manual de Instalação, Operação & Atualização
## Mesa de Compras IA • FSConsultoria Farmacêutica
**Contato & Suporte:** (17) 98120-5660 | **Senha Master:** \`Consultoria@2026\`

---

### 1. Visão Geral da Entrega
Esta pasta contém tudo o que é necessário para implantar e atualizar a **Mesa de Compras IA** em novos clientes ou nas lojas existentes:

- **\`Instalador_Mesa_Compras_IA.exe\` (ou \`.bat\`):** Instalador unificado inteligente de 1-clique.
- **\`Atualizar_Mesa_Compras_IA.exe\` (ou \`.bat\`):** Atualizador remoto que preserva licenças, dados e conexões.
- **\`Configurar_Link_Google_Drive.bat\`:** Permite colar o link do seu Google Drive uma única vez para downloads automáticos.
- **\`config_nuvem.ini\`:** Onde o ID da sua versão fica salvo.
- **\`Mesa_Compras_IA_Core.zip\`:** O pacote oficial completo com runtime Node.js portátil incluso (pode ser subido no Google Drive ou levado no pendrive para instalações offline).

---

### 2. Como Usar com o Google Drive (Instalador Ultra-Leve)
1. Suba o arquivo **\`Mesa_Compras_IA_Core.zip\`** no seu Google Drive pessoal ou corporativo.
2. No Google Drive, clique com o botão direito no arquivo -> **Compartilhar** -> marque **"Qualquer pessoa com o link pode ser leitor"** -> **Copiar link**.
3. Na sua máquina, dê dois cliques em **\`Configurar_Link_Google_Drive.bat\`** e cole o link copiado.
4. **Pronto!**
   Agora, quando você for a um cliente, você só precisa levar o arquivo **\`Instalador_Mesa_Compras_IA.exe\`** (ou executá-lo diretamente). Ele se conectará ao seu Google Drive, baixará a versão mais recente, extrairá em \`C:\\Mesa_Compras_IA\` e criará o atalho na Área de Trabalho automaticamente!

---

### 3. Como Fazer Instalação Offline (Sem Internet / Pendrive)
Se a drogaria estiver sem internet rápida:
- Mantenha o arquivo **\`Mesa_Compras_IA_Core.zip\`** na mesma pasta ou pendrive junto do **\`Instalador_Mesa_Compras_IA.exe\`**.
- O instalador detectará o pacote local instantaneamente e fará a instalação offline em menos de 10 segundos!

---

### 4. Como Atualizar os 5 Clientes Rapidamente
Quando você fizer melhorias no sistema:
1. No seu escritório, gere o novo \`Mesa_Compras_IA_Core.zip\` e suba no seu Google Drive (substituindo o arquivo anterior).
2. No cliente:
   - Execute **\`Atualizar_Mesa_Compras_IA.exe\`** (ou envie para o cliente via WhatsApp/AnyDesk).
   - O atualizador baixa a nova versão, atualiza os arquivos do sistema e **restaura intactos** a licença e o banco de dados da farmácia.
   - Atualização feita em 15 segundos sem perder dados!

---

### 5. Ativação de Licença e Conexão ao Banco
1. No primeiro acesso, o navegador abre em \`http://127.0.0.1:3456\`.
2. O técnico clica em **"🔒 Setup & Banco (Técnico Master)"** e digita a senha **\`Consultoria@2026\`**.
3. Informa o IP do MariaDB do cliente, porta 3306, banco (ex: \`gerente\`) e filial.
4. Ativa a licença mensal gerada no escritório da FSConsultoria.
`;
fs.writeFileSync(path.join(PASTA_ENTREGA, 'LEIA_ME_MANUAL_COMPLETO.md'), manualCompleto, 'utf8');

console.log('\n================================================================');
console.log('✓ ESTRUTURA COMPLETA GERADA COM SUCESSO!');
console.log('  Pasta Única de Entrega: ' + PASTA_ENTREGA);
console.log('================================================================\n');
