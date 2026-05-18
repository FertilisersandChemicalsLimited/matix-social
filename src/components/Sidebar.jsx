import React from 'react';
import { APP_NAME } from '../utils/config';

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1.5"/>
      <rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/>
      <rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  ),
  'post-creator': (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 4l6 6L9 21H3v-6L14 4z" strokeLinejoin="round"/>
    </svg>
  ),
  schedule: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round"/>
    </svg>
  ),
  logs: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v4H4zM4 12h16v4H4zM4 20h10v0" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="6" r="0.5" fill="currentColor" />
      <circle cx="7" cy="14" r="0.5" fill="currentColor" />
    </svg>
  )
};

export default function Sidebar({ nav, current, onNavigate, onCreate, session, onLogout }) {
  const emailLetter = session?.email ? session.email.charAt(0).toUpperCase() : 'M';
  const displayName = session?.email ? session.email.split('@')[0] : 'Matix';
  const [brandFirst, brandSecond] = APP_NAME.split(' ');
  return (
    <aside className="w-60 h-full bg-cream-100/90 backdrop-blur-xl border-r border-cream-300/60 flex flex-col relative overflow-hidden">
      {/* subtle vertical accent */}
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cream-300/60 to-transparent"/>

      <div className="px-6 pt-6 pb-6 animate-fade-up shrink-0">
        <div className="h-display text-2xl text-brand-700 leading-none">{brandFirst}</div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500 mt-1.5">{brandSecond}</div>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto space-y-1 py-2 scrollbar-none">
        {nav.map((item, i) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{ animationDelay: `${80 + i * 60}ms` }}
              className={[
                'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium animate-fade-up',
                'transition-all duration-200 ease-snap shrink-0',
                active
                  ? 'bg-gradient-to-r from-brand-100 to-brand-50 text-brand-700 shadow-soft'
                  : 'text-ink-700 hover:bg-cream-200/70 hover:translate-x-0.5'
              ].join(' ')}
            >
              <span className={`transition-colors ${active ? 'text-brand-700' : 'text-ink-600 group-hover:text-brand-600'}`}>
                {ICONS[item.id]}
              </span>
              <span>{item.label}</span>

              {/* animated active rail */}
              <span className={[
                'absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full bg-brand-700',
                'transition-all duration-300 ease-snap',
                active ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'
              ].join(' ')}/>
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-4 pt-3 border-t border-cream-300/60 shrink-0 bg-cream-100/50">
        <button
          onClick={onCreate}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <SparkIcon/> New Post
        </button>
        <div className="mt-3 flex items-center gap-3 px-1">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 ring-2 ring-cream-50 shadow-soft flex items-center justify-center text-white font-semibold shrink-0">
            {emailLetter}
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink-900 truncate">{displayName}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-500 truncate">{session?.email || 'Signed in'}</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="h-8 w-8 rounded-lg text-ink-500 hover:text-brand-700 hover:bg-cream-200/70 flex items-center justify-center transition-all shrink-0"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" strokeLinejoin="round"/>
  </svg>
);
