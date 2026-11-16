import { getAnalyticsDb, getMotorTransfers } from '../src/store/analyticsDb.mjs';
const db = getAnalyticsDb('bandeirante');
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND (name LIKE '%transf%' OR name LIKE '%reman%')").all();
console.log(JSON.stringify(tables, null, 2));

const trfs = getMotorTransfers('bandeirante');
console.log('Transfers:', JSON.stringify(trfs, null, 2));
