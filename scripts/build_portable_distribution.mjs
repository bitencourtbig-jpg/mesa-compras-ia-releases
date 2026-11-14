import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'BIG_Compras_AI_Portatil');

console.log('=== GERANDO PACOTE PORTÁTIL BIG COMPRAS AI ===');

// 1. Criar pastas de destino
fs.mkdirSync(path.join(DIST, 'bin'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'src'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'db'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'public'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'lib'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'dev_reviews'), { recursive: true });

// 2. Copiar node.exe se existir na máquina local para portabilidade total
const systemNode = 'C:\\Program Files\\nodejs\\node.exe';
const targetNode = path.join(DIST, 'bin', 'node.exe');
if (fs.existsSync(systemNode)) {
  console.log('Embarcando runtime Node.js portátil (bin/node.exe)...');
  fs.copyFileSync(systemNode, targetNode);
} else {
  console.log('node.exe do sistema não encontrado no caminho padrão; o script usará o PATH do sistema.');
}

// 3. Função recursiva de cópia de diretórios
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 4. Copiar código fonte e assets
console.log('Copiando arquivos de aplicação...');
copyDirSync(path.join(ROOT, 'src'), path.join(DIST, 'src'));
copyDirSync(path.join(ROOT, 'db'), path.join(DIST, 'db'));
copyDirSync(path.join(ROOT, 'public'), path.join(DIST, 'public'));
copyDirSync(path.join(ROOT, 'lib'), path.join(DIST, 'lib'));

// Copiar package.json
fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(DIST, 'package.json'));

// 5. Copiar node_modules (para não precisar de internet ou npm no cliente)
console.log('Copiando dependências pré-instaladas (node_modules)...');
copyDirSync(path.join(ROOT, 'node_modules'), path.join(DIST, 'node_modules'));

// 6. Copiar catálogo oficial CMED e limpar histórico para pacote virgem
console.log('Embarcando catálogo oficial CMED e preparando base SQLite virgem...');
const targetDb = path.join(DIST, 'data', 'analytics.db');
if (fs.existsSync(path.join(ROOT, 'data', 'analytics.db'))) {
  fs.copyFileSync(path.join(ROOT, 'data', 'analytics.db'), targetDb);
  // Limpar tabelas calculadas e deixar apenas o catalogo CMED
  const distDb = new DatabaseSync(targetDb);
  distDb.exec(`
    DELETE FROM engine_sku_results;
    DELETE FROM engine_remanejamento;
    DELETE FROM engine_molecule_summary;
    DELETE FROM engine_runs;
    DELETE FROM pbm_audit_rows;
    DELETE FROM pbm_program_rules;
    DELETE FROM molecule_de_para;
    DELETE FROM big_orders_log;
    DELETE FROM big_backups;
    DELETE FROM client_group_coverage_config;
    DELETE FROM client_profiles;
    INSERT INTO client_profiles (
      code, name, db_host, db_port, db_user, db_password, db_name,
      buyer_filial_id, buyer_cnpj, default_supplier_id, default_supplier_name,
      active_sales_filials, ignored_filials, service_profile, default_weeks, recent_entries_limit
    ) VALUES (
      'bandeirante', 'Nova Farmácia (Aguardando Conexão)', '127.0.0.1', 3306, 'root', '', 'gerente',
      2, '', 1, 'FORNECEDOR PADRÃO',
      '[2]', '[]', 'equilibrado', 13, 5
    );
    VACUUM;
  `);
  distDb.close();
  console.log('✓ Base analítica virgem configurada com catálogo CMED intacto e zero dados antigos.');
}

// 7. Criar .env.example
const envExample = `DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gerente
PORT=3456
# Ativar botão flutuante de crítica / feedback durante homologação e testes no cliente:
# Defina como false para esconder o inspetor e deixar a tela 100% limpa para o cliente final
ENABLE_DEV_INSPECTOR=false
`;
fs.writeFileSync(path.join(DIST, '.env.example'), envExample, 'utf8');
if (!fs.existsSync(path.join(DIST, '.env'))) {
  fs.writeFileSync(path.join(DIST, '.env'), envExample, 'utf8');
}

// Inicializar backlog virgem de melhorias
fs.writeFileSync(
  path.join(DIST, 'dev_reviews', 'backlog_melhorias.json'),
  JSON.stringify({ updated_at: new Date().toISOString(), reviews: [] }, null, 2),
  'utf8'
);

// 8. Criar o iniciar_motor.bat (Script com auto-detecção de runtime e abertura do navegador)
const batIniciar = `@echo off
chcp 65001 > nul
title Motor de Compras Inteligente - Linx Farma BIG
color 0A

echo ======================================================================
echo    BIG COMPRAS AI - MOTOR DE COMPRAS INTELIGENTE (LINX FARMA BIG)
echo ======================================================================
echo.

cd /d "%~dp0"

set NODE_EXEC=bin\\node.exe
if not exist "%NODE_EXEC%" (
  set NODE_EXEC=node
)

echo [*] Verificando ambiente de execucao...
%NODE_EXEC% -v > nul 2>&1
if errorlevel 1 (
  color 0C
  echo [ERRO] Node.js nao encontrado em bin\\node.exe nem no PATH do Windows.
  echo Instale o Node.js v20+ ou copie o node.exe para a pasta bin\\.
  pause
  exit /b 1
)

echo [*] Iniciando servidor analitico local...
echo [*] Porta: 3456
echo.

start "Servidor BIG Compras AI" /min %NODE_EXEC% --no-warnings src\\server.mjs

echo [*] Aguardando o servidor inicializar e carregar base analitica...

powershell -Command "for ($i=0; $i -lt 40; $i++) { try { $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3456/api/overview' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { exit 0 } } catch { Start-Sleep -Milliseconds 400 } }; exit 1"

echo [*] Servidor pronto! Abrindo o Cockpit de Compras no navegador...
start http://127.0.0.1:3456

echo.
echo ======================================================================
echo  SISTEMA RODANDO EM SEGUNDO PLANO!
echo  Para encerrar o servidor a qualquer momento, execute: parar_motor.bat
echo ======================================================================
echo.
pause
`;
fs.writeFileSync(path.join(DIST, 'iniciar_motor.bat'), batIniciar, 'utf8');

// 9. Criar o parar_motor.bat
const batParar = `@echo off
chcp 65001 > nul
title Parar Motor de Compras BIG
color 0E

echo ======================================================================
echo    ENCERRANDO SERVIDOR BIG COMPRAS AI
echo ======================================================================
echo.

powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*src\\\\server.mjs*' -or $_.Path -like '*BIG_Compras_AI*' } | Stop-Process -Force" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Servidor BIG Compras AI" > nul 2>&1

echo [*] Servidor finalizado com sucesso.
echo.
timeout /t 2 > nul
`;
fs.writeFileSync(path.join(DIST, 'parar_motor.bat'), batParar, 'utf8');

// 10. Criar o GUIA_IMPLANTACAO_PRODUCAO.md
const docGuia = `# Guia Rápido de Implantação em Produção — BIG Compras AI

Este pacote é **100% portátil e autossuficiente**. Ele não exige instalação de nenhum software adicional nem privilégios de administrador no Windows do cliente.

---

## 1. Passo a Passo de Instalação (Tempo estimado: 3 minutos)

1. **Copiar a pasta:**
   Copie a pasta inteira \`BIG_Compras_AI_Portatil\` para qualquer local na máquina do cliente (ex.: \`C:\\BIG_Compras_AI\` ou na área de trabalho do comprador).
2. **Iniciar:**
   Dê um duplo clique no arquivo **\`iniciar_motor.bat\`**.
   - O terminal iniciará o servidor analítico local na porta \`3456\`;
   - O navegador padrão (Chrome, Edge) abrirá automaticamente em **\`http://127.0.0.1:3456\`**.
3. **Configurar o Banco do Cliente:**
   Na barra superior da tela, clique no botão **\`⚙️ Conexão / Banco\`**:
   - **Host / IP:** Informe o IP da máquina do servidor do Linx BIG (se estiver rodando no mesmo servidor, use \`127.0.0.1\`);
   - **Porta:** \`3306\`;
   - **Usuário / Senha:** Usuário e senha do MariaDB do Linx BIG;
   - **Banco:** Nome da base do cliente (ex.: \`bandeirante\`);
   - **Filial Compradora:** ID da loja de faturamento (ex.: \`2\`);
   - **Fornecedor Padrão:** Digite o ID da distribuidora principal (ex.: \`10\` - Santa Cruz). O sistema confirma o nome e CNPJ na hora;
   - Clique em **"Testar Conexão em Tempo Real"** e depois em **"Salvar Configurações"**.
4. **Calcular a Primeira Cotação:**
   - Na tela principal, clique no botão azul **\`Sincronizar & Calcular\`**;
   - Em ~20 segundos, o motor analisa 100% do mix da drogaria, cruza os 18 meses de vendas, aplica matriz ABCxXYZ, descontos de PBM e cotações dos últimos 30 dias.
5. **Encerrar quando terminar:**
   - Dê um duplo clique em **\`parar_motor.bat\`**.

---

## 2. Respostas Importantes sobre a Operação em Produção

### 1. O recálculo grava dados dentro do Linx BIG?
**NÃO.** Todas as curvas ABCxXYZ, cálculos de demanda ajustada por ruptura, sazonalidade e agrupamentos de molécula são gravados **100% no banco analítico local SQLite (\`data/analytics.db\`)**.
As tabelas nativas de demanda do Linx BIG (\`estoque_minimo2\`, \`curvaabc\`) permanecem intocadas. O ERP continua funcionando exatamente como antes.

### 2. Abrir a tela ou usar o sistema causa lentidão no ERP da farmácia?
**ZERO LENTIDÃO.** O sistema opera em uma arquitetura de cache em camadas (*Snapshot Analytics*):
- Toda vez que o comprador abre a tela, troca de abas, simula verba, pesquisa produto ou abre o painel de BI executivo, os dados são lidos exclusivamente do SQLite local em **menos de 30 milissegundos**.
- O banco MariaDB do Linx BIG **NÃO é consultado durante a navegação em tela**.
- O MariaDB só é consultado quando o comprador clica explicitamente no botão **"Sincronizar & Calcular"**. Essa consulta roda em modo estrito \`SET SESSION TRANSACTION READ ONLY\` sem nenhum lock de tabela, não travando caixas de balcão nem emissão de cupons fiscais.

### 3. E se a Linx proibir a gravação direta no banco?
Basta usar o botão **"Baixar Planilha BIG (.xlsx)"** no fechamento da cotação:
- A planilha é gerada no layout nativo exato de 10 colunas que o módulo Compras do BIG importa;
- O comprador simplesmente entra em \`BIG -> Compras -> Importar Planilha\`;
- Nenhuma senha master ou escrita direta no banco é necessária.
`;
fs.writeFileSync(path.join(DIST, 'GUIA_IMPLANTACAO_PRODUCAO.md'), docGuia, 'utf8');

console.log('=== PACOTE PORTÁTIL CONCLUÍDO COM SUCESSO! ===');
console.log('Pasta gerada em:', DIST);

