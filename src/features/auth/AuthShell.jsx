import React from 'react';

export default function AuthShell({ title, description, children }) {
  return (
    <main className="auth-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.95)_0%,rgba(241,245,249,0.3)_48%,rgba(226,232,240,0.45)_100%)]" />
      <section className="relative w-full max-w-[402px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        <div className="h-1 bg-teal-700" />
        <div className="px-6 pb-5 pt-6 sm:px-7">
          <div className="mb-5 text-center">
            <div className="inline-flex flex-col items-center leading-none">
              <span className="text-[30px] font-black tracking-[0.08em] text-teal-800">RAYZON</span>
              <span className="mt-1 text-[11px] font-bold tracking-[0.48em] text-slate-500">SOLAR</span>
            </div>
          </div>
          <div className="mb-4">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          {children}
        </div>
        <footer className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-center text-xs font-medium text-slate-400">
          © 2026 Rayzon Solar Limited — Internal use only
        </footer>
      </section>
    </main>
  );
}
