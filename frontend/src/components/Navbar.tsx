'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  if (!user) return null;

  const isAdmin = user.is_staff;

  return (
    <nav className="sticky top-0 z-50 border-b" style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          {/* Logo only */}
          <div className="flex items-center gap-3">
            <Link href={isAdmin ? '/admin-dashboard' : '/dashboard'} className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 bg-primary-red rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                M
              </div>
              <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--foreground)' }}>MSAS</span>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary-red/10 text-primary-red">
                  Admin
                </span>
              )}
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-border-brown/20 text-secondary-brown"
              aria-label="Toggle dark mode"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                /* Sun icon — shown in dark mode to switch to light */
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                /* Moon icon — shown in light mode to switch to dark */
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-6" style={{ background: 'var(--border)' }}></div>

            {/* User avatar */}
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
                  {user.first_name ? `${user.first_name} ${user.last_name}` : user.username}
                </p>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>@{user.username}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary-red/10 border-2 border-primary-red/20 flex items-center justify-center text-primary-red font-bold text-sm">
                {(user.first_name || user.username)[0].toUpperCase()}
              </div>
            </div>

            <div className="w-px h-6" style={{ background: 'var(--border)' }}></div>

            <button onClick={logout}
              className="text-sm font-medium text-secondary-brown hover:text-primary-red transition-colors">
              Sign out
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}
