import React, { useState, useEffect, useRef } from 'react';
import DailyView from './components/DailyView.jsx';
import MonthlyView from './components/MonthlyView.jsx';
import OptionsView from './components/OptionsView.jsx';
import GeneralOverview from './components/GeneralOverview.jsx';
import WorkoutBuilder from './components/WorkoutBuilder.jsx';
import GearView from './components/GearView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { PacesProvider, usePaces } from './utils/PacesContext.jsx';
import { ReadOnlyProvider, useReadOnly } from './context/ReadOnlyContext.jsx';

const DEFAULT_VIEW = 'monthly';
const APP_TITLE = 'Web Fitness - Stage 4';

// Timestamped logger utility
const originalLog = console.log;
console.log = (...args) => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  originalLog(`[${timestamp}]`, ...args);
};

// Mount/Unmount Debug Wrapper
const WithDebugLog = ({ name, children }) => {
  useEffect(() => {
    console.log(`[App Debug] ✅ SUCCESS: <${name} /> mounted successfully.`);
    return () => console.log(`[App Debug] ℹ️ UNMOUNT: <${name} /> unmounted.`);
  }, [name]);

  return children;
};

// Navigation Tab Configuration
const TABS = [
  { id: 'daily', label: 'Daily View', component: DailyView },
  { id: 'monthly', label: 'Monthly View', component: MonthlyView },
  { id: 'overview', label: 'General Overview', component: GeneralOverview },
  { id: 'workout-builder', label: 'Workout Builder', component: WorkoutBuilder },
  { id: 'gear', label: 'Gear', component: GearView },
  { id: 'options', label: 'Options', component: OptionsView },
];

function HeaderBar({
  menuOpen,
  setMenuOpen,
  activeTab,
  setActiveTab,
  themeView,
}) {
  const { paces, loading } = usePaces();
  const readOnly = useReadOnly();
  const navRef = useRef(null);

  useEffect(() => {
    if (loading) {
      console.log('[HeaderBar Debug] ⏳ Pace data is loading...');
    } else if (paces) {
      console.log('[HeaderBar Debug] 📊 Pace data loaded:', paces);
    } else {
      console.log('[HeaderBar Debug] ⚠️ Pace data is null or failed to load.');
    }
  }, [paces, loading]);

  // Click Outside to Dismiss Menu
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        console.log('[App Debug] 🖱️ Clicked outside nav -> Closing menu');
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, setMenuOpen]);

  const handleSelectTab = (tabId) => {
    console.log(`[App Debug] 🎯 Tab select requested: "${tabId}"`);
    setActiveTab(tabId);
    setMenuOpen(false);
  };

  return (
      <header
        ref={navRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: '1px solid #ccc',
          position: 'relative',
          flexShrink: 0,
          zIndex: 1000,
          backgroundColor: themeView === 'dark' ? '#121212' : '#f9f9f9',
        }}
      >
      <h1
        onClick={() => {
          console.log('[App Debug] 🏠 Title clicked -> Navigating to Monthly View');
          setActiveTab('monthly');
        }}
        style={{
          margin: 0,
          fontSize: '20px',
          color: 'var(--text-h, inherit)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        title="Go to Monthly View"
      >
        {APP_TITLE}{readOnly ? ' - Read-Only' : ''}
        {loading && ' (Loading...)'}
        {!loading && paces?.name && ` - ${paces.name}`}
      </h1>

      <button
        onClick={() => setMenuOpen((prev) => !prev)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          color: 'var(--text-h, inherit)',
          padding: '4px 8px',
          lineHeight: 1,
        }}
        aria-label="Options Menu"
        aria-expanded={menuOpen}
      >
        &#9776;
      </button>

      {menuOpen && (
        <nav
          style={{
            position: 'absolute',
            top: '100%',
            right: '20px',
            backgroundColor: themeView === 'dark' ? '#1e1e1e' : '#ffffff',
            color: themeView === 'dark' ? '#ffffff' : '#000000',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 1000,
            minWidth: '160px',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              style={{
                ...dropdownBtnStyle(themeView),
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                backgroundColor:
                  activeTab === tab.id
                    ? themeView === 'dark'
                      ? '#333'
                      : '#f0f0f0'
                    : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

    </header>
  );
}

export default function App() {
  console.log('[App Debug] 🚀 Render cycle started.');

  const [activeTab, setActiveTab] = useState(DEFAULT_VIEW);
  const [menuOpen, setMenuOpen] = useState(false);

  const [layoutVersion, setLayoutVersion] = useState(
    () => localStorage.getItem('wf_version') || 'desktop'
  );
  const [themeView, setThemeView] = useState(
    () => localStorage.getItem('wf_theme') || 'light'
  );
  const [rightOffset, setRightOffset] = useState(
    () => Number(localStorage.getItem('wf_offset')) || 0
  );

  useEffect(() => {
    localStorage.setItem('wf_version', layoutVersion);
    localStorage.setItem('wf_theme', themeView);
    localStorage.setItem('wf_offset', rightOffset);
  }, [layoutVersion, themeView, rightOffset]);

  const getThemeStyles = () => {
    if (themeView === 'dark') return { backgroundColor: '#121212', color: '#ffffff' };
    if (themeView === 'bw')
      return {
        backgroundColor: '#ffffff',
        color: '#000000',
        filter: 'grayscale(100%)',
      };
    return { backgroundColor: '#f9f9f9', color: '#1a1a1a' };
  };

  const activeTabConfig = TABS.find((tab) => tab.id === activeTab) || TABS[1]; // Fallback to Monthly
  const ActiveComponent = activeTabConfig.component;

  return (
    <ReadOnlyProvider>
      <PacesProvider>
      <div
        style={{
          ...getThemeStyles(),
          height: '100vh',
          marginRight: `${rightOffset}px`,
          boxSizing: 'border-box',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <HeaderBar
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          themeView={themeView}
        />

        <main
          style={{
            padding: layoutVersion === 'mobile' ? '10px' : '20px',
            maxWidth: layoutVersion === 'mobile' ? '480px' : '100%',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <ErrorBoundary key={activeTabConfig.id} name={activeTabConfig.label}>
            <WithDebugLog name={ActiveComponent.name || activeTabConfig.label}>
              <ActiveComponent
                {...(activeTabConfig.id === 'options'
                  ? {
                      layoutVersion,
                      setLayoutVersion,
                      themeView,
                      setThemeView,
                      rightOffset,
                      setRightOffset,
                    }
                  : {})}
              />
            </WithDebugLog>
          </ErrorBoundary>
        </main>
      </div>
      </PacesProvider>
    </ReadOnlyProvider>
  );
}

const dropdownBtnStyle = (themeView) => ({
  background: 'none',
  border: 'none',
  textAlign: 'left',
  padding: '8px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  color: themeView === 'dark' ? '#ffffff' : '#000000',
  width: '100%',
});
