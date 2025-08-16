import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // If you don't use react-router, pass `onNavigate` from parent instead

// --- SVG Icons ---
const MenuIcon = () => (
    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CloseIcon = () => (
    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

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
// Usage notes:
// 1) Preferred: pass `onNavigate(page)` from parent (App.js) to control navigation.
// 2) If you don't pass onNavigate, this component will use react-router's `useNavigate()`.
//    So make sure your app is wrapped with <BrowserRouter> and react-router-dom is installed.

const Navbar = ({ user, onLogout = () => {}, onNavigate }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const routerNavigate = useNavigate(); // fallback navigation when onNavigate is not provided

    const navigateTo = (page) => {
        if (typeof onNavigate === 'function') {
            // Parent provided navigation handler
            onNavigate(page);
            return;
        }

        // Fallback: use react-router navigation
        const route = ROUTE_MAP[page] || '/';
        try {
            routerNavigate(route);
        } catch (err) {
            // As a last resort, navigate with full reload (not ideal but safe)
            // Only used if react-router is not available at runtime (shouldn't happen if you imported useNavigate).
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

    const navLinks = [
        { page: 'home', label: 'Home' },
        ...(user ? [{ page: 'homepage', label: 'Dashboard' }] : []),
        ...(user ? [{ page: 'pastpapers', label: 'Past Papers' }] : []),
        ...(user ? [{ page: 'analytics', label: 'Analytics' }] : []),
        { page: 'contact', label: 'Contact' },
    ];

    return (
        <nav className="bg-gray-800/60 backdrop-blur-lg sticky top-0 z-50 rounded-b-lg shadow-lg border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo and App Title */}
                    <div className="flex-shrink-0">
                        <button
                            onClick={(e) => handleNavClick('home', e)}
                            className="text-2xl font-bold text-white cursor-pointer hover:text-gray-300 transition-colors"
                        >
                            JEE Genius
                        </button>
                    </div>

                    {/* Desktop Navigation Links */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navLinks.map((link) => (
                                <button
                                    key={link.label}
                                    onClick={(e) => handleNavClick(link.page, e)}
                                    className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                                >
                                    {link.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right-side section for desktop */}
                    <div className="hidden md:flex items-center space-x-4">
                        {user ? (
                            <>
                                <span className="text-gray-300 text-sm">Welcome, {user.name}!</span>
                                <button
                                    onClick={handleLogoutClick}
                                    className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-all duration-300"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={(e) => handleNavClick('login', e)}
                                    className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={(e) => handleNavClick('signup', e)}
                                    className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105"
                                >
                                    Sign Up
                                </button>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="-mr-2 flex md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            type="button"
                            className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                            aria-controls="mobile-menu"
                            aria-expanded={isMenuOpen}
                        >
                            <span className="sr-only">Open main menu</span>
                            {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`} id="mobile-menu">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                    {navLinks.map((link) => (
                        <button
                            key={link.label}
                            onClick={(e) => handleNavClick(link.page, e)}
                            className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium transition-colors w-full text-left"
                        >
                            {link.label}
                        </button>
                    ))}

                    <div className="pt-4 mt-4 border-t border-gray-700">
                        {user ? (
                            <button
                                onClick={handleLogoutClick}
                                className="w-full text-left bg-red-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-red-700 transition-all duration-300"
                            >
                                Logout ({user.name})
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={(e) => handleNavClick('login', e)}
                                    className="block w-full text-center mt-2 bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-blue-700 transition-all duration-300"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={(e) => handleNavClick('signup', e)}
                                    className="block w-full text-center mt-2 bg-green-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-700 transition-all duration-300"
                                >
                                    Sign Up
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
