import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth < 1280
  ));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Fixed Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      {/* Right Main Area */}
      <div className="flex flex-1 flex-col h-screen min-w-0 overflow-hidden">
        {/* Fixed Header */}
        <Header
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onOpenMobile={() => setMobileOpen(true)}
        />

        {/* Full-width scrollable viewport */}
        <main className="app-main flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 xl:p-5 2xl:p-6 scroll-smooth">
          <div className="app-content mx-auto w-full max-w-[1800px] space-y-4 xl:space-y-5 2xl:space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
