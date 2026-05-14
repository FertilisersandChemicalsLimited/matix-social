import React, { useEffect, useMemo, useState } from 'react';
import { FIELDS, AIRTABLE_PAT } from '../utils/config.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { Spinner } from '../components/Loader.jsx';

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); }
  catch { return iso; }
}

/* count-up animation hook */
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export default function Dashboard({ data, onNavigate }) {
  const { records, loading, error, refresh } = data;

  const counts = useMemo(() => ({
    total: records.length,
    pending: records.filter(r => r.fields[FIELDS.published] === 'Pending').length,
    approved: records.filter(r => r.fields[FIELDS.published] === 'Scheduled').length,
    posted: records.filter(r => r.fields[FIELDS.published] === 'Posted').length
  }), [records]);
  const upcoming = useMemo(() => {
    return records
      .filter(r => {
        const status = r.fields[FIELDS.approvalStatus];
        return status === 'Pending';
      })
      .sort((a, b) => new Date(b.fields[FIELDS.date] || 0) - new Date(a.fields[FIELDS.date] || 0))
      .slice(0, 4);
  }, [records]);

  const recent = useMemo(() => (
    [...records]
      .filter(r => r.fields[FIELDS.published] === 'Posted')
      .sort((a, b) => new Date(b.fields[FIELDS.postDate] || 0) - new Date(a.fields[FIELDS.postDate] || 0))
      .slice(0, 4)
  ), [records]);

  return (
    <>
      <TopBar title="Dashboard" loading={loading} onRefresh={refresh} />

      <main className="px-4 lg:px-10 py-8 max-w-6xl w-full">
        {!AIRTABLE_PAT && (
          <div className="mb-6 rounded-xl border border-brand-300/40 bg-brand-50 px-4 py-3 text-sm text-brand-800 animate-fade-up">
            <strong>Missing credentials.</strong> Add <code className="px-1 bg-white/60 rounded">VITE_AIRTABLE_PAT</code> to your <code className="px-1 bg-white/60 rounded">.env</code> and restart the dev server.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-accent-red/30 bg-brand-50 px-4 py-3 text-sm text-brand-800 animate-fade-up">
            {error}
          </div>
        )}

        <header className="animate-fade-up">
          {/* <div className="inline-flex items-center gap-2 text-[10px] lg:text-[11px] uppercase tracking-[0.18em] text-brand-700 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-700 animate-pulse-soft" />
            Command Center
          </div> */}
          <h1 className="h-display text-3xl lg:text-5xl text-ink-900 mt-2">
            Welcome back, <span className="bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">Admin</span>
          </h1>
          <p className="mt-2 lg:mt-3 text-ink-600 max-w-2xl text-sm lg:text-base">
            Your content engine at a glance. Draft, schedule, and  LinkedIn posts on a single canvas.
          </p>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mt-8 stagger">
          <Stat label="Total Posts" value={counts.total} />
          <Stat label="Pending" value={counts.pending} tone="amber" />
          <Stat label="Scheduled" value={counts.approved} tone="green" />
          <Stat label="Published" value={counts.posted} tone="blue" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-8 stagger">
          <div className="lg:col-span-2 card card-hover p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="h-display text-2xl text-ink-900">Upcoming</h2>
              <button onClick={() => onNavigate('schedule')}
                className="text-sm text-brand-700 font-medium inline-flex items-center gap-1 hover:gap-2 transition-all duration-200">
                View pipeline <span aria-hidden>→</span>
              </button>
            </div>
            {loading && !records.length ? (
              <Skeleton rows={4} />
            ) : upcoming.length === 0 ? (
              <Empty
                title="Nothing on deck"
                hint="Draft a new post to start filling your pipeline."
                action={<button onClick={() => onNavigate('post-creator')} className="btn-primary mt-4">Create Post</button>}
              />
            ) : (
              <ul className="divide-y divide-cream-200">
                {upcoming.map((r, i) => {
                  const f = r.fields;
                  const datePart = fmtDate(f[FIELDS.postDate] || f[FIELDS.date]).split(' ');
                  return (
                    <li key={r.id}
                      onClick={() => onNavigate('post-creator', r.id)}
                      style={{ animationDelay: `${80 + i * 50}ms` }}
                      className="py-3 flex items-center gap-4 animate-fade-up group cursor-pointer rounded-lg px-2 -mx-2 hover:bg-cream-50 transition">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 font-semibold flex flex-col items-center justify-center text-xs leading-tight ring-1 ring-brand-100 group-hover:scale-105 transition-transform">
                        <span>{datePart[1]}</span>
                        <span className="text-[10px] -mt-0.5">{datePart[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink-900 truncate group-hover:text-brand-700 transition-colors">
                          {f[FIELDS.eventName] || '(untitled)'}
                        </div>
                        <div className="text-xs text-ink-500 mt-0.5 truncate">
                          {f[FIELDS.captionDraft]?.slice(0, 80) || f[FIELDS.imagePrompt] || '—'}
                        </div>
                      </div>
                      <StatusBadge value={f[FIELDS.approvalStatus]} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-brand-gradient  text-white p-6 shadow-lift animate-scale-in">
            {/* decorative orbs */}
            <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-brand-300/20 blur-3xl" />

            <div className="relative ">
              <div className="text-[11px] uppercase tracking-[0.18em] text-brand-200">Quick Action</div>
              <h3 className="h-display text-2xl mt-2">Draft today's influence</h3>
              <p className="text-sm text-brand-100/90 mt-2">
                From blank page to scheduled post in under three minutes with the AI-assisted creator.
              </p>
              <button
                onClick={() => onNavigate('post-creator')}
                className="mt-5 group bg-white text-brand-700 hover:bg-cream-100 transition-all rounded-lg px-4 py-2.5 font-semibold text-sm inline-flex items-center gap-2 hover:gap-3 shadow-soft hover:shadow-lift"
              >
                Open Post Creator
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 card p-6 animate-fade-up">
          <div className="flex items-center justify-between mb-5">
            <h2 className="h-display text-2xl text-ink-900">Recently Published</h2>
            <button onClick={refresh} className="text-sm text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 transition-colors">
              {loading ? <Spinner /> : <RefreshIcon />}
              Refresh
            </button>
          </div>
          {recent.length === 0 ? (
            <Empty title="No posts published yet" hint="Once a post ships to LinkedIn it will land here." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
              {recent.map((r) => {
                const f = r.fields;
                return (
                  <a
                    key={r.id}
                    href={f[FIELDS.linkedinUrl] || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl border border-cream-200 hover:border-brand-300/60 hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 p-4 flex gap-4"
                  >
                    <div className="h-20 w-20 rounded-lg overflow-hidden bg-cream-200 shrink-0">
                      {f[FIELDS.generatedImage] ? (
                        <img src={f[FIELDS.generatedImage]} alt=""
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-ink-500">{fmtDate(f[FIELDS.postDate])}</div>
                      <div className="font-medium text-ink-900 truncate group-hover:text-brand-700 transition-colors">{f[FIELDS.eventName] || '(untitled)'}</div>
                      <div className="text-xs text-ink-500 mt-1 line-clamp-2">{f[FIELDS.captionDraft] || '—'}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function TopBar({ title, loading, onRefresh }) {
  return (
    <header className="sticky top-0 z-20 glass border-b border-cream-300/60">
      <div className="px-4 lg:px-10 lg:pr-48 h-16 flex items-center justify-between">
        <div className="h-display text-2xl text-ink-900">{title}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg p-2 text-ink-600 hover:bg-cream-100 hover:text-brand-700 disabled:opacity-50 transition-all"
            title="Refresh"
          >
            {loading ? <Spinner /> : <RefreshIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, tone = 'brand' }) {
  const display = useCountUp(value);
  const tones = {
    brand: { num: 'text-brand-700', dot: 'bg-brand-700' },
    amber: { num: 'text-accent-amber', dot: 'bg-accent-amber' },
    green: { num: 'text-accent-green', dot: 'bg-accent-green' },
    blue: { num: 'text-accent-blue', dot: 'bg-accent-blue' }
  };
  const t = tones[tone];
  return (
    <div className="card card-hover px-5 py-4 relative overflow-hidden">
      <div className={`absolute top-3 right-3 h-2 w-2 rounded-full ${t.dot} animate-pulse-soft`} />
      <div className={`text-3xl font-bold tabular-nums ${t.num}`}>{display}</div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-ink-500 mt-1">{label}</div>
    </div>
  );
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg shimmer" />
      ))}
    </div>
  );
}

function Empty({ title, hint, action }) {
  return (
    <div className="text-center py-10 animate-fade-in">
      <div className="font-medium text-ink-900">{title}</div>
      <div className="text-sm text-ink-500 mt-1">{hint}</div>
      {action}
    </div>
  );
}

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
