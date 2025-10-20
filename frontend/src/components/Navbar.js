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
  Sparkles,
  GraduationCap
} from 'lucide-react';

// --- Route map / helper ---
const ROUTE_MAP = {
  home: '/',
  homepage: '/dashboard',
  pastpapers: '/past-papers',
  analytics: '/analytics',
  contact: '/contact',
  login: '/login',
  signup: '/signup',
};

// --- Navbar Component ---
const Navbar = ({ user, onLogout = () => {}, onNavigate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const routerNavigate = useNavigate();
  const location = useLocation();

  const navigateTo = (page) => {
    if (typeof onNavigate === 'function') {
      onNavigate(page);
      return;
    }

    const route = ROUTE_MAP[page] || '/';
    try {
      routerNavigate(route);
    } catch (err) {
      window.location.href = route;
    }
  };

  const handleLogoutClick = () => {
    console.log('Navbar logout clicked');
    if (typeof onLogout === 'function') onLogout();
    setIsMenuOpen(false);
  };

  const handleNavClick = (page, event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    console.log('Navbar navigation to:', page);
    navigateTo(page);
    setIsMenuOpen(false);
  };

  const isActivePage = (page) => {
    const route = ROUTE_MAP[page];
    return location.pathname === route;
  };

  const navLinks = [
    { page: 'home', label: 'Home', icon: Home },
    ...(user ? [{ page: 'homepage', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(user ? [{ page: 'pastpapers', label: 'Past Papers', icon: FileText }] : []),
    ...(user ? [{ page: 'analytics', label: 'Analytics', icon: BarChart3 }] : []),
    { page: 'contact', label: 'Contact', icon: Mail },
  ];

  return (
    <>
      <nav className="bg-gradient-to-r from-gray-900/95 via-slate-900/95 to-gray-900/95 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-700/50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo and App Title */}
            <div className="flex-shrink-0 group cursor-pointer" onClick={(e) => handleNavClick('home', e)}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <GraduationCap className="w-7 h-7 text-blue-400" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 group-hover:from-blue-300 group-hover:to-purple-400 transition-all duration-300">
                    JEE Genius
                  </h1>
                  <p className="text-xs text-gray-500 font-medium">Master Your Future</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-center space-x-2">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = isActivePage(link.page);
                  
                  return (
                    <button
                      key={link.label}
                      onClick={(e) => handleNavClick(link.page, e)}
                      className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        isActive 
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl blur-lg"></div>
                      )}
                      <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-blue-400' : 'group-hover:text-blue-400'} transition-colors duration-300`} />
                      <span className="relative z-10">{link.label}</span>
                      {isActive && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right-side section for desktop */}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-700/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                    </div>
                    <span className="text-gray-300 text-sm font-semibold">{user.name}</span>
                  </div>
                  <button
                    onClick={handleLogoutClick}
                    className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-400 font-semibold rounded-xl transition-all duration-300 border border-red-500/30 hover:border-red-500/50 hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-red-600/0 group-hover:from-red-500/10 group-hover:to-red-600/10 rounded-xl blur-lg transition-all duration-300"></div>
                    <LogOut className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => handleNavClick('login', e)}
                    className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-400 font-semibold rounded-xl transition-all duration-300 border border-blue-500/30 hover:border-blue-500/50 hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/10 group-hover:to-blue-600/10 rounded-xl blur-lg transition-all duration-300"></div>
                    <LogIn className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Login</span>
                  </button>
                  <button
                    onClick={(e) => handleNavClick('signup', e)}
                    className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500/20 to-purple-600/20 hover:from-purple-500/30 hover:to-purple-600/30 text-purple-400 font-semibold rounded-xl transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50 hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-purple-600/0 group-hover:from-purple-500/10 group-hover:to-purple-600/10 rounded-xl blur-lg transition-all duration-300"></div>
                    <UserPlus className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Sign Up</span>
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                type="button"
                className="group relative p-3 bg-gray-800/60 backdrop-blur-xl rounded-xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300"
                aria-controls="mobile-menu"
                aria-expanded={isMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {isMenuOpen ? (
                  <X className="h-6 w-6 text-gray-300 group-hover:text-white transition-colors duration-300" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-300 group-hover:text-white transition-colors duration-300" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div 
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          }`} 
          id="mobile-menu"
        >
          <div className="px-4 pt-2 pb-6 space-y-2 bg-gradient-to-b from-gray-900/50 to-gray-900/80 backdrop-blur-xl border-t border-gray-700/30">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isActivePage(link.page);
              
              return (
                <button
                  key={link.label}
                  onClick={(e) => handleNavClick(link.page, e)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span>{link.label}</span>
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-gray-700/50 space-y-2">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-700/50 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                    </div>
                    <span className="text-gray-300 text-sm font-semibold">{user.name}</span>
                  </div>
                  <button
                    onClick={handleLogoutClick}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-400 font-semibold rounded-xl transition-all duration-300 border border-red-500/30"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => handleNavClick('login', e)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-400 font-semibold rounded-xl transition-all duration-300 border border-blue-500/30"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>Login</span>
                  </button>
                  <button
                    onClick={(e) => handleNavClick('signup', e)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500/20 to-purple-600/20 hover:from-purple-500/30 hover:to-purple-600/30 text-purple-400 font-semibold rounded-xl transition-all duration-300 border border-purple-500/30"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Sign Up</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
