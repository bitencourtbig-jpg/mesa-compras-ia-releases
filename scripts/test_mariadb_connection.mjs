import mysql from 'mysql2/promise';

async function test() {
  const t0 = Date.now();
  console.log('Testing connection to 127.0.0.1:3306 ...');
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '123456big',
      database: 'gerente_bf',
      connectTimeout: 5000
    });
    console.log('Connected successfully in', Date.now() - t0, 'ms');
    const [rows] = await conn.query('SELECT 1 as test');
    console.log('Query result:', rows);
    await conn.end();
  } catch (err) {
    console.error('Connection error:', err);
  }
}

test();
