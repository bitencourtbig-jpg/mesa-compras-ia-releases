import { getAnalyticsDb, getClientProfile } from '../src/store/analyticsDb.mjs';
import { syncBigClientData } from '../src/engine/syncClientData.mjs';

const clientCode = 'bandeirante';
const profile = getClientProfile(clientCode);
console.log('CLIENT PROFILE:', { code: profile?.code, user: profile?.db_user, host: profile?.db_host, name: profile?.db_name });

console.log('Starting sync benchmark...');
const t0 = Date.now();
try {
  const data = await syncBigClientData(profile, { weeks: 13 });
  console.log('SYNC SUCCESS in', ((Date.now() - t0) / 1000).toFixed(2), 'seconds!');
  console.log('Products:', data.products?.length);
  console.log('SalesFilials:', data.salesFilials);
  console.log('Pending Transfers:', data.pendingTransfers?.incomingMap?.size);
} catch (err) {
  console.error('SYNC FAILED after', ((Date.now() - t0) / 1000).toFixed(2), 'seconds:', err);
}
