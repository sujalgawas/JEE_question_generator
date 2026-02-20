import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  LayoutDashboard,
  FileText,
  BarChart3,
  Mail,
  LogOut,
  LogIn,
  UserPlus,
  GraduationCap,
} from 'lucide-react';

const ROUTE_MAP = {
  home: '/',
  homepage: '/dashboard',
  pastpapers: '/past-papers',
  analytics: '/analytics',
  contact: '/contact',
  login: '/login',
  signup: '/signup',
};

const Navbar = ({ user, onLogout = () => { }, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const routerNavigate = useNavigate();
  const location = useLocation();

  const navigateTo = (page) => {
    if (typeof onNavigate === 'function') { onNavigate(page); return; }
    const route = ROUTE_MAP[page] || '/';
    try { routerNavigate(route); } catch { window.location.href = route; }
  };

  const handleLogoutClick = () => { onLogout(); setIsMenuOpen(false); };
  const handleNavClick = (page, e) => { e?.preventDefault?.(); navigateTo(page); setIsMenuOpen(false); };
  const isActive = (page) => location.pathname === ROUTE_MAP[page];

  const navLinks = [
    { page: 'home', label: 'Home', icon: Home },
    ...(user ? [
      { page: 'homepage', label: 'Dashboard', icon: LayoutDashboard },
      { page: 'pastpapers', label: 'Past Papers', icon: FileText },
      { page: 'analytics', label: 'Analytics', icon: BarChart3 },
    ] : []),
    { page: 'contact', label: 'Contact', icon: Mail },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-surface-900/95 backdrop-blur-md border-b border-surface-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={(e) => handleNavClick('home', e)} className="flex items-center gap-2.5 group">
            <div className="p-1.5 rounded-lg bg-accent-500/10 border border-accent-500/20 group-hover:bg-accent-500/15 transition-colors">
              <GraduationCap className="w-5 h-5 text-accent-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">JEE Genius</h1>
              <p className="text-[10px] text-surface-500 leading-none">Master Your Future</p>
            </div>
          </button>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.page);
              return (
                <button
                  key={link.page}
                  onClick={(e) => handleNavClick(link.page, e)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${active
                      ? 'bg-accent-500/10 text-accent-400'
                      : 'text-surface-400 hover:text-white hover:bg-surface-800'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </button>
              );
            })}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-surface-400">
                  <span className="inline-block w-1.5 h-1.5 bg-success-500 rounded-full mr-1.5 animate-pulse-soft" />
                  {user.name}
                </span>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-danger-400 hover:bg-danger-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => handleNavClick('login', e)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-surface-300 hover:text-white hover:bg-surface-800 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
                <button
                  onClick={(e) => handleNavClick('signup', e)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent-600 hover:bg-accent-500 text-white transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </button>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-surface-800 transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5 text-surface-300" /> : <Menu className="w-5 h-5 text-surface-300" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-200 ${isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 pt-1 space-y-1 border-t border-surface-700/50">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.page);
            return (
              <button
                key={link.page}
                onClick={(e) => handleNavClick(link.page, e)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-accent-500/10 text-accent-400' : 'text-surface-400 hover:text-white hover:bg-surface-800'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-surface-700/50 space-y-1">
            {user ? (
              <>
                <div className="px-3 py-2 text-sm text-surface-400">
                  <span className="inline-block w-1.5 h-1.5 bg-success-500 rounded-full mr-1.5" />
                  {user.name}
                </div>
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-danger-400 hover:bg-danger-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => handleNavClick('login', e)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-300 hover:bg-surface-800 transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Login
                </button>
                <button
                  onClick={(e) => handleNavClick('signup', e)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-accent-600 hover:bg-accent-500 text-white transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
