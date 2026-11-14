import { createReadOnlyConnection, runReadOnlyQuery } from '../db/client.mjs';
import { getClientProfile } from '../src/store/analyticsDb.mjs';

async function main() {
  const p = getClientProfile('default');
  const conn = await createReadOnlyConnection({
    host: '206.85.23.138',
    port: 3306,
    user: 'root',
    password: p.db_password,
    database: 'gerente'
  });

  try {
    const list = ['entradas', 'pedidos', 'lote_novo', 'perda', 'transacao_pbm', 'transacao_pbm_desconto_item'];
    const placeholders = list.map(() => '?').join(',');
    const check = await runReadOnlyQuery(conn, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'gerente' AND table_name IN (${placeholders})`, list);
    console.log('Checked tables present in gerente:', check.map(r => r.table_name || r.TABLE_NAME));
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
