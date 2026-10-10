export const normalizeUsername = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.-]/g,'').slice(0,48);
export function accountUsername(record, records) {
 const preferred = normalizeUsername(record.data.firstName || record.data.name.split(/\s+/)[0]) || 'user';
 const peers = records.filter(r => ['profile','student'].includes(r.kind));
 const taken = peers.some(r => r.id !== record.id && (r.data.username === preferred || normalizeUsername(r.data.firstName || r.data.name.split(/\s+/)[0]) === preferred));
 return taken ? `${preferred}.${record.id.replaceAll('-','')}` : preferred;
}
export const accountEmail = record => `${record.id}@accounts.ghs-mbonjo.invalid`;
export const canProvision = record => ['profile','student'].includes(record.kind) && !record.data.authId && record.data.active !== false && !['dismissed','transferred out'].includes(record.data.status);
