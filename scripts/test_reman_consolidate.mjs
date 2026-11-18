import http from 'http';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const req = http.request(`http://127.0.0.1:3456${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testConsolidate() {
  console.log('Testing /api/remanejamento/consolidate-routes:');
  const res = await post('/api/remanejamento/consolidate-routes', {});
  console.log('Response:', res);
}

testConsolidate().catch(console.error);
