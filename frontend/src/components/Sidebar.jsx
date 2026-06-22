import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, LogIn, UserCheck, CalendarCheck,
  AlertTriangle, BarChart3, Settings, ChevronLeft, ChevronRight, ScrollText, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';

const LANGUAGES = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'lt', label: 'Lietuvių', flag: '🇱🇹' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

function LangSwitcher({ collapsed }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const selectLang = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('admin_lang', code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-abat-grau hover:text-white hover:bg-abat-blau/20 transition-colors rounded-lg ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? current.label : undefined}
      >
        <Globe size={16} className="flex-shrink-0" />
        {!collapsed && (
          <span className="text-sm flex-1 text-left">{current.flag} {current.label}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute ${collapsed ? 'left-full ml-2 bottom-0' : 'bottom-full mb-1 left-0 right-0'} z-20 bg-abat-dunkelgrau border border-white/10 rounded-xl shadow-xl overflow-hidden`}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => selectLang(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors
                  ${lang.code === i18n.language
                    ? 'bg-abat-blau text-white'
                    : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'
                  }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/visitors', label: t('nav.visitors'), icon: Users },
    { to: '/hosts', label: t('nav.hosts'), icon: UserCheck },
    { to: '/preregistrations', label: t('nav.preregistrations'), icon: CalendarCheck },
    { to: '/evacuation', label: t('nav.evacuation'), icon: AlertTriangle },
    { to: '/reports', label: t('nav.reports'), icon: BarChart3 },
  ];

  const adminItems = [
    { to: '/settings', label: t('nav.settings'), icon: Settings, roles: ['superadmin', 'admin'] },
    { to: '/audit-log', label: t('nav.auditLog'), icon: ScrollText, roles: ['superadmin'] },
  ];

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 bg-abat-dunkelgrau text-white flex flex-col transition-all duration-300 ease-in-out`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed ? (
          <img src="/logo-light.png" alt="abat AG" className="h-10" />
        ) : (
          <div className="w-8 h-8 bg-abat-blau rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">a</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1 px-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'bg-abat-blau text-white shadow-lg'
                  : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Admin items */}
        {user && (user.role === 'superadmin' || user.role === 'admin') && (
          <div className="mt-4 pt-4 border-t border-white/10 px-2 space-y-1">
            {!collapsed && <p className="px-3 text-xs text-abat-grau uppercase tracking-wider mb-2">{t('nav.administration')}</p>}
            {adminItems.filter(item => !item.roles || item.roles.includes(user.role)).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-abat-blau text-white'
                    : 'text-abat-hellgrau hover:bg-abat-blau/20 hover:text-white'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Language switcher + Collapse button */}
      <div className="border-t border-white/10 px-2 py-2 space-y-1">
        <LangSwitcher collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-abat-grau hover:text-white hover:bg-abat-blau/20 transition-colors rounded-lg ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <>
              <ChevronLeft size={18} />
              <span className="text-sm">{t('nav.collapse')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
