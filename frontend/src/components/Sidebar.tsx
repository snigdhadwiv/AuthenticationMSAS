'use client';
import React from 'react';

export interface SidebarLink {
  name: string;
  isActive: boolean;
  onClick: () => void;
}

export default function Sidebar({ links }: { links: SidebarLink[] }) {
  return (
    <aside className="w-64 flex-shrink-0 min-h-[calc(100vh-64px)] border-r hidden md:block" style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)' }}>
      <nav className="flex flex-col mt-6">
        {links.map(l => (
          <button
            key={l.name}
            onClick={l.onClick}
            className={`px-6 py-4 text-sm font-bold tracking-wider uppercase border-l-4 text-left transition-all ${
              l.isActive ? 'border-primary-red' : 'border-transparent'
            }`}
            style={{ 
              color: l.isActive ? 'var(--primary-red)' : 'var(--foreground)',
              backgroundColor: l.isActive ? 'rgba(211, 47, 47, 0.05)' : 'transparent',
              opacity: l.isActive ? 1 : 0.7
            }}
          >
            {l.name}
          </button>
        ))}
      </nav>
    </aside>
  );
}
