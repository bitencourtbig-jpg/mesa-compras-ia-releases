import { getAnalyticsDb, getClientProfile } from '../src/store/analyticsDb.mjs';

const db = getAnalyticsDb();
db.prepare(`UPDATE client_profiles SET active_sales_filials = '[2, 3, 4]', ignored_filials = '[1]', updated_at = datetime('now') WHERE code = 'bandeirante'`).run();
console.log('Client profile updated:', getClientProfile('bandeirante'));

