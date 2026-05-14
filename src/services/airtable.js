import { AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, AIRTABLE_PAT } from '../utils/config.js';

const API_BASE = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

function headers() {
  if (!AIRTABLE_PAT) throw new Error('Missing VITE_AIRTABLE_PAT in .env');
  return {
    Authorization: `Bearer ${AIRTABLE_PAT}`,
    'Content-Type': 'application/json'
  };
}

async function handle(res) {
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    let errorDetail = txt;
    try {
      const parsed = JSON.parse(txt);
      if (parsed.error && parsed.error.message) {
        errorDetail = parsed.error.message;
      }
    } catch (e) {}
    console.error(`[Airtable Error] ${res.status}:`, errorDetail);
    throw new Error(`Airtable ${res.status}: ${errorDetail}`);
  }
  return res.json();
}

export async function listRecords({ pageSize = 100 } = {}) {
  const all = [];
  let offset;
  do {
    const url = new URL(API_BASE);
    url.searchParams.set('pageSize', pageSize);
    if (offset) url.searchParams.set('offset', offset);
    const data = await handle(await fetch(url, { headers: headers() }));
    if (data.records && data.records.length > 0) {
      console.log('[Airtable] Available fields in first record:', Object.keys(data.records[0].fields));
    }
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
}

export async function getRecord(id) {
  return handle(await fetch(`${API_BASE}/${id}`, { headers: headers() }));
}

export async function createRecord(fields) {
  console.log('[Airtable] Creating record with fields:', fields);
  const payload = { records: [{ fields }], typecast: true };
  console.log('[Airtable] POST Payload:', JSON.stringify(payload, null, 2));
  
  const data = await handle(await fetch(API_BASE, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload)
  }));
  console.log('[Airtable] Record created:', data.records[0].id);
  return data.records[0];
}

export async function updateRecord(id, fields) {
  return handle(await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ fields, typecast: true })
  }));
}

export async function deleteRecord(id) {
  return handle(await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: headers()
  }));
}
