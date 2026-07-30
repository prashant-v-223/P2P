import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
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

      {/* Fixed Sidebar (Stays fixed on left desktop viewport, never scrolls with page) */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      {/* Right Column: Fixed Header + Independent Scrollable Page Container */}
      <div className="flex flex-1 flex-col h-screen min-w-0 overflow-hidden">
        
        {/* Fixed Header */}
        <Header
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onOpenMobile={() => setMobileOpen(true)}
        />

        {/* Independent Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-4 lg:py-4 scroll-smooth">
          <div className="mx-auto w-full space-y-6">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
}
