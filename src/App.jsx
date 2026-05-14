import React, { useState } from 'react';
import { ToastProvider } from './components/Toast.jsx';
import { useRecords } from './hooks/useRecords.js';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PostCreator from './pages/PostCreator.jsx';
import Schedule from './pages/Schedule.jsx';

import LoginModal from './components/LoginModal.jsx';

const NAV = [
  { id: 'dashboard',    label: 'Dashboard'    },
  { id: 'post-creator', label: 'Post Creator' },
  { id: 'schedule',     label: 'Pipeline'     }
];

function Shell() {
  const [page, setPage] = useState('dashboard');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Auth State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('forge_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showLogin, setShowLogin] = useState(false);

  const data = useRecords();

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('forge_user', JSON.stringify(userData));
    setShowLogin(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('forge_user');
    setPage('dashboard');
  };

  const handleNavigate = (id, recordId = null) => {
    if (!user && id !== 'dashboard') {
      setShowLogin(true);
      return;
    }
    setSelectedRecordId(recordId);
    setPage(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-cream-50 overflow-x-hidden relative">
      {/* Auth Modal */}
      {showLogin && <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop: Fixed, Mobile: Drawer */}
      <div className={`
        fixed top-0 left-0 bottom-0 w-60 z-50 transition-transform duration-300 ease-snap
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar 
          nav={NAV} 
          current={page} 
          onNavigate={handleNavigate} 
          onCreate={() => handleNavigate('post-creator')} 
        />
      </div>

      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-cream-100 border-b border-cream-300/60 flex items-center justify-between px-4 z-30">
        <div className="flex items-center">
          <button 
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 text-ink-700 hover:text-brand-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="ml-2 h-display text-lg text-brand-700 font-bold">Forge</div>
        </div>

        {user ? (
          <button onClick={handleLogout} className="text-[10px] uppercase tracking-wider font-bold text-ink-500">
            Logout
          </button>
        ) : (
          <button onClick={() => setShowLogin(true)} className="text-[10px] uppercase tracking-wider font-bold text-brand-700 bg-brand-100 px-3 py-1 rounded-full">
            Sign In
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-60 min-w-0 relative pt-14 lg:pt-0">
        {/* Desktop Auth Shortcut */}
        {user ? (
          <button 
            onClick={handleLogout}
            className="hidden lg:flex absolute top-6 right-10 z-20 text-[10px] uppercase tracking-widest font-bold text-ink-400 hover:text-brand-700 transition-colors items-center gap-2"
          >
            Sign Out
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <button 
            onClick={() => setShowLogin(true)}
            className="hidden lg:flex absolute top-6 right-10 z-20 text-[10px] uppercase tracking-widest font-bold px-4 py-2 bg-brand-100 text-brand-700 rounded-full hover:bg-brand-700 hover:text-white transition-all shadow-sm items-center gap-2"
          >
            Sign In
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <div 
          key={page} 
          className="animate-fade-up"
          onClickCapture={(e) => {
            if (!user && page === 'dashboard') {
              const target = e.target.closest('article, .card-hover, button');
              if (target && !target.closest('.lg\\:hidden')) {
                e.stopPropagation();
                e.preventDefault();
                setShowLogin(true);
              }
            }
          }}
        >
          {page === 'dashboard'    && <Dashboard data={data} onNavigate={handleNavigate} />}
          {page === 'post-creator' && <PostCreator data={data} onNavigate={handleNavigate} initialRecordId={selectedRecordId} />}
          {page === 'schedule'     && <Schedule data={data} onNavigate={handleNavigate} />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
