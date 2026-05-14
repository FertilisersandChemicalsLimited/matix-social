import React, { useEffect, useMemo, useState } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import { Spinner } from '../components/Loader.jsx';
import { FIELDS } from '../utils/config.js';

function dayKey(d) {
  if (!d) return null;
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}
function fmtGroup(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((ts - today.getTime()) / (1000 * 60 * 60 * 24));
  
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: 'long' }).toUpperCase();
  const year = d.getFullYear();
  const currentYear = new Date().getFullYear();
  
  const base = `${day} ${month}${year !== currentYear ? ` ${year}` : ''}`;
  
  if (diff === 0) return `TODAY, ${base}`;
  if (diff === -1) return `YESTERDAY, ${base}`;
  if (diff === 1) return `TOMORROW, ${base}`;
  return base;
}
function fmtTime(d) {
  if (!d) return '';
  const date = new Date(d);
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Check if it's a plain date (no hours/mins/secs)
  const isPlainDate = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && d.length <= 10;

  if (isPlainDate) return dateStr;
  return `${dateStr} (${timeStr})`;
}

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export default function Schedule({ data, onNavigate }) {
  const { records, loading, refresh } = data;
  const [limit, setLimit] = useState(10);
  const [view, setView] = useState('list');
  const [activeFilter, setActiveFilter] = useState('All');

  const counts = useMemo(() => ({
    Scheduled: records.filter(r => r.fields[FIELDS.published] == 'Scheduled').length,
    Pending: records.filter(r => r.fields[FIELDS.published] === 'Pending').length,
    Posted: records.filter(r => r.fields[FIELDS.published] === 'Posted').length,
    All: records.length
  }), [records]);

  const filteredRecords = useMemo(() => {
    const base = records.filter(r => r.fields[FIELDS.approvalStatus] !== 'Regenerate');
    let res = [...base];

    if (activeFilter === 'Scheduled') {
      res = base.filter(r => r.fields[FIELDS.published] == 'Scheduled');
    } else if (activeFilter === 'Pending') {
      res = base.filter(r => r.fields[FIELDS.published] === 'Pending');
    } else if (activeFilter === 'Posted') {
      res = base.filter(r => r.fields[FIELDS.published] === 'Posted')
    }

    // Sort by date descending (latest first)
    return res.sort((a, b) => {
      const getVal = (r) => {
        if (activeFilter === 'All' || activeFilter === 'Pending') {
          // Use Airtable's internal record creation time for true "recently created" order
          return new Date(r.createdTime).getTime();
        }
        const d = r.fields[FIELDS.schedulingDate] || r.fields[FIELDS.postDate] || r.fields[FIELDS.date];
        return d ? new Date(d).getTime() : 0;
      };
      return getVal(b) - getVal(a);
    });
  }, [records, activeFilter])

  const visibleRecords = useMemo(() => filteredRecords.slice(0, limit), [filteredRecords, limit]);

  useEffect(() => {
    setLimit(10);
  }, [activeFilter]);

  const groups = useMemo(() => {
    const dated = visibleRecords
      .map(r => {
        let d;
        if (activeFilter === 'All' || activeFilter === 'Pending') {
          d = r.createdTime;
        } else {
          d = r.fields[FIELDS.schedulingDate] || r.fields[FIELDS.postDate] || r.fields[FIELDS.date];
        }
        return d ? { r, ts: dayKey(d) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.ts - a.ts);
    const map = new Map();
    for (const { r, ts } of dated) {
      if (!map.has(ts)) map.set(ts, []);
      map.get(ts).push(r);
    }
    return Array.from(map.entries());
  }, [visibleRecords, activeFilter]);

  const efficiency = useMemo(() => {
    const total = records.length || 1;
    const ok = records.filter(r => r.fields[FIELDS.published] === 'Posted').length;
    return Math.round((ok / total) * 1000) / 10;
  }, [records]);
  const animatedEff = useCountUp(efficiency);

  return (
    <>
      <header className="sticky top-0 z-20 glass border-b border-cream-300/60">
        <div className="px-4 lg:px-10 lg:pr-48 h-16 flex items-center gap-3">
          <span className="text-xs lg:text-sm text-ink-700 inline-flex items-center gap-2">
            Active Pipeline
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-accent-green animate-ping opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-accent-green" />
            </span>
          </span>
          <div className="flex-1" />
          <button onClick={refresh} className="text-sm text-ink-500 hover:text-brand-700 inline-flex items-center gap-1.5 transition-colors">
            {loading ? <Spinner /> : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span className="hidden sm:inline"></span>
          </button>
        </div>
      </header>

      <main className="px-4 lg:px-10 py-8 max-w-6xl w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-fade-up">
          <div>
            <h1 className="h-display text-3xl lg:text-5xl text-ink-900">
              Content <span className="bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">Pipeline</span>
            </h1>
            <p className="text-ink-500 mt-2 text-sm lg:text-base">Synced with your scheduled LinkedIn drops.</p>
          </div>
          <div className="rounded-full bg-cream-100 border border-cream-300/60 p-1 inline-flex shadow-soft w-full sm:w-auto overflow-x-auto scrollbar-none">
            <ToggleBtn active={view === 'list'} onClick={() => setView('list')}>List View</ToggleBtn>
            {/* <ToggleBtn active={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</ToggleBtn> */}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* sidebar filters */}
          <div className="lg:col-span-1 space-y-5 stagger order-1">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold text-ink-900">Filter</div>
                {activeFilter !== 'All' && (
                  <button onClick={() => setActiveFilter('All')} className="text-[10px] uppercase tracking-wider text-brand-600 font-bold hover:underline">Clear</button>
                )}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
                <FilterRow label="All" count={counts.All} tone="slate" active={activeFilter === 'All'} onClick={() => setActiveFilter('All')} />
                <FilterRow label="Scheduled" count={counts.Scheduled} tone="brand" active={activeFilter === 'Scheduled'} onClick={() => setActiveFilter('Scheduled')} />
                <FilterRow label="Pending" count={counts.Pending} tone="blue" active={activeFilter === 'Pending'} onClick={() => setActiveFilter('Pending')} />
                <FilterRow label="Posted" count={counts.Posted} tone="green" active={activeFilter === 'Posted'} onClick={() => setActiveFilter('Posted')} />
              </div>
            </div>

            <div className="rounded-2xl bg-brand-gradient text-white p-6 shadow-lift relative overflow-hidden hidden lg:block">
              <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-brand-300/20 blur-3xl" />
              <div className="relative">
                <div className="text-[11px] uppercase tracking-[0.16em] text-brand-200 font-semibold">Publish Efficiency</div>
                <div className="text-4xl font-bold mt-2 tabular-nums">{animatedEff.toFixed(1)}%</div>
                <div className="mt-4 h-1.5 rounded-full bg-brand-800/60 overflow-hidden">
                  <div
                    className="h-full bg-cream-50 rounded-full transition-[width] duration-700 ease-snap"
                    style={{ width: `${efficiency}%` }}
                  />
                </div>
                <svg viewBox="0 0 100 30" className="absolute right-2 bottom-2 h-12 w-24 text-brand-300/60" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M0 22 L20 18 L40 24 L60 12 L80 16 L100 6" strokeLinecap="round" strokeLinejoin="round" pathLength="1"
                    style={{ strokeDasharray: 1, strokeDashoffset: 0, animation: 'shimmer 2s ease-out' }} />
                </svg>
              </div>
            </div>
          </div>

          {/* timeline */}
          <div className="lg:col-span-3 space-y-8 relative order-2 max-h-[1000px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cream-300">
            {visibleRecords.length === 0 ? (
              <div className="rounded-2xl bg-white border border-dashed border-cream-300 p-16 text-center animate-fade-up">
                <div className="font-semibold text-ink-900">{activeFilter === 'All' ? 'Pipeline empty' : 'No matches found'}</div>
                <p className="text-sm text-ink-500 mt-1">{activeFilter === 'All' ? 'Draft and schedule a post to see it here.' : `No ${activeFilter.toLowerCase()} posts in this view.`}</p>
                {activeFilter === 'All' ? (
                  <button onClick={() => onNavigate('post-creator')} className="btn-primary mt-5">Create Post</button>
                ) : (
                  <button onClick={() => setActiveFilter('All')} className="btn-ghost mt-4">Show All Posts</button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-8">
                  {groups.map(([ts, rows], gi) => (
                    <div key={ts} style={{ animationDelay: `${gi * 80}ms` }} className="animate-fade-up">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-px flex-1 bg-cream-300/70" />
                        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500 font-semibold whitespace-nowrap">
                          {fmtGroup(ts)}
                        </div>
                        <div className="h-px flex-1 bg-cream-300/70" />
                      </div>
                      <div className="space-y-4 stagger">
                        {rows.map(r => <PipelineCard key={r.id} record={r} onClick={() => onNavigate('post-creator', r.id)} />)}
                      </div>
                    </div>
                  ))}
                </div>

                {limit < filteredRecords.length && (
                  <div className="pt-4 pb-8 flex justify-center">
                    <button
                      onClick={() => setLimit(prev => prev + 10)}
                      className="btn-ghost text-brand-700 font-bold flex items-center gap-2 hover:bg-brand-50"
                    >
                      Load More ({filteredRecords.length - limit} remaining)
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* <button
              onClick={() => onNavigate('post-creator')}
              title="New post"
              className="fixed bottom-8 right-10 h-14 w-14 rounded-full btn-primary shadow-glow flex items-center justify-center text-2xl hover:scale-110 transition-transform duration-200 z-30"
            >
              +
            </button> */}
          </div>
        </div>
      </main>
    </>
  );
}

function FilterRow({ label, count, tone, active, onClick }) {
  const toneCls = {
    brand: active ? 'bg-brand-gradient text-white' : 'bg-brand-50 text-brand-700',
    blue: active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-accent-blue',
    green: active ? 'bg-green-600 text-white' : 'bg-green-50 text-accent-green',
    slate: active ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600'
  }[tone];

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between py-2 px-2.5 -mx-2.5 rounded-lg group cursor-pointer transition-all ${active ? 'bg-cream-100' : 'hover:bg-cream-50'}`}
    >
      <span className={`text-sm font-medium transition-colors ${active ? 'text-ink-900' : 'text-ink-700 group-hover:text-ink-900'}`}>{label}</span>
      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 transition-all min-w-[24px] text-center ${toneCls}`}>
        {count}
      </span>
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
        active
          ? 'bg-gradient-to-br from-accent-blue to-blue-700 text-white shadow-soft scale-[1.02]'
          : 'text-ink-600 hover:text-ink-900'
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function PipelineCard({ record, onClick }) {
  const f = record.fields;
  const posted = f[FIELDS.published] === 'Posted';
  const isScheduled = !posted && !!f[FIELDS.schedulingDate];
  const isPending = !posted && !isScheduled && f[FIELDS.approvalStatus] === 'Pending';

  const tag =
    posted ? { text: 'POSTED', cls: 'bg-accent-green text-white' } :
      isScheduled ? { text: 'SCHEDULED', cls: 'bg-brand-gradient text-white' } :
        { text: 'PENDING', cls: 'bg-blue-100 text-accent-blue' };

  return (
    <article
      onClick={onClick}
      className="group rounded-2xl overflow-hidden border flex flex-col sm:flex-row transition-all duration-300 ease-snap bg-white border-cream-300/60 shadow-soft hover:shadow-lift hover:-translate-y-1 hover:border-brand-200 cursor-pointer"
    >
      <div className="w-full sm:w-44 h-40 sm:h-auto shrink-0 bg-cream-200 relative overflow-hidden">
        {f[FIELDS.generatedImage] ? (
          <img src={f[FIELDS.generatedImage]} alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        ) : null}
        <span className={`absolute top-3 left-3 text-[10px] font-bold tracking-wider rounded-md px-2 py-1 shadow-soft ${tag.cls}`}>
          {tag.text}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex-1 min-w-0 p-5">
        {isScheduled && (
          <div className="text-xs text-ink-500 inline-flex items-center gap-1.5 mb-2">
            <ClockIcon /> {fmtTime(f[FIELDS.schedulingDate] || f[FIELDS.postDate] || f[FIELDS.date])}
          </div>
        )}
        {isPending && (
          <div className="text-xs text-accent-blue font-semibold inline-flex items-center gap-1.5 mb-2">
            <SyncIcon /> PENDING...
          </div>
        )}
        {isScheduled && (
          <div className="text-xs text-brand-600 font-semibold inline-flex items-center gap-1.5 mb-2 pl-4">
            <ClockIcon fill="currentColor" /> SCHEDULED
          </div>
        )}

        <h3 className="text-lg font-bold transition-colors text-ink-900 group-hover:text-brand-700">
          {f[FIELDS.eventName] || '(untitled)'}
        </h3>
        <p className="mt-1 text-sm text-ink-700 line-clamp-2 text-ink-900">
          {f[FIELDS.captionDraft] || f[FIELDS.imagePrompt] || '—'}
        </p>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <StatusBadge value={f[FIELDS.postType]} />
          <StatusBadge value={f[FIELDS.captionStyle]} />
          {posted && <StatusBadge value="Posted" />}
        </div>
      </div>
    </article>
  );
}

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);
const SyncIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin-slow" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 12a9 9 0 0 1-15.5 6.3L3 16" strokeLinecap="round" />
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h0" strokeLinecap="round" />
  </svg>
);
