import { WEBHOOK_URL } from '../utils/config.js';

async function fire(payload) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Webhook ${res.status}: ${txt || res.statusText}`);
  }
  try { return await res.json(); } catch { return { ok: true }; }
}

export const triggerGenerate = (record) => fire({ action: 'generate', ...record });
export const triggerPostNow  = (record) => fire({ action: 'post_now',  ...record });
export const triggerSchedule = (record, scheduledAt) =>
  fire({ action: 'schedule', scheduled_at: scheduledAt, ...record });
