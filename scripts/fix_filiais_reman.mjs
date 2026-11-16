import fs from 'node:fs';

const filePath = 'src/server.mjs';
let code = fs.readFileSync(filePath, 'utf8');

const targetLine = "const filiais = db.prepare('SELECT DISTINCT filial_id, nome_loja, nome_reduz FROM config_filiais WHERE client_code = ? AND filial_id <> 1 ORDER BY filial_id ASC').all(clientCode);";

const replLine = `const clientPolicies = getFilialPolicies(clientCode).filter((p) => Number(p.filial_id) !== 1);
      const filiais = clientPolicies.map((p) => ({
        filial_id: Number(p.filial_id),
        label: \`L\${String(p.filial_id).padStart(2, '0')} • \${p.nome_reduz || p.nome_loja?.slice(0, 15) || \`Loja \${p.filial_id}\`}\`,
        short: \`L\${String(p.filial_id).padStart(2, '0')} (\${p.nome_reduz || \`F\${p.filial_id}\`})\`
      }));`;

if (code.includes(targetLine)) {
  code = code.replace(targetLine, replLine);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('src/server.mjs corrigido com getFilialPolicies!');
} else {
  console.log('Target line não encontrada.');
}
