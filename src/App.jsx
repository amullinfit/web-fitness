import React, { useState, useEffect } from 'react';
import DailyView from './components/DailyView.jsx';
import MonthlyView from './components/MonthlyView.jsx';
import GeneralOverview from './components/GeneralOverview.jsx'; 
//import WorkoutBuilder from './components/WorkoutBuilder.jsx';
import GearView from './components/GearView.jsx';
import OptionsView from './components/OptionsView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { PacesProvider } from './utils/PacesContext.jsx';

// [DEBUG Helper] Wrap components to log successful mounts and unmounts
const WithDebugLog = ({ name, children }) => {
  useEffect(() => {
    console.log(`[App Debug] ✅ SUCCESS: <${name} /> mounted successfully.`);
    return () => console.log(`[App Debug] ℹ️ UNMOUNT: <${name} /> unmounted.`);
  }, [name]);

  return children;
};

const APP_TITLE = 'Web Fitness';

export default function App() {
  console.log('[App Debug] 🚀 Render cycle started.');

  // Local state per browser instance
  const [activeTab, setActiveTab] = useState(() => {
    console.log('[App Debug] Initializing activeTab state to "daily"');
    return 'daily';
  });

  const [menuOpen, setMenuOpen] = useState(() => {
    console.log('[App Debug] Initializing menuOpen state to false');
    return false;
  });

  const [layoutVersion, setLayoutVersion] = useState(() => {
    const val = localStorage.getItem('wf_version') || 'desktop';
    console.log(`[App Debug] Loaded layoutVersion: "${val}"`);
    return val;
  });

  const [themeView, setThemeView] = useState(() => {
    const val = localStorage.getItem('wf_theme') || 'light';
    console.log(`[App Debug] Loaded themeView: "${val}"`);
    return val;
  });

  const [rightOffset, setRightOffset] = useState(() => {
    const val = Number(localStorage.getItem('wf_offset')) || 0;
    console.log(`[App Debug] Loaded rightOffset: ${val}`);
    return val;
  });

  // Track state changes after initial render
  useEffect(() => {
    console.log(`[App Debug] State updated -> activeTab: "${activeTab}"`);
  }, [activeTab]);

  useEffect(() => {
    console.log(`[App Debug] State updated -> menuOpen: ${menuOpen}`);
  }, [menuOpen]);

  // Sync to LocalStorage
  useEffect(() => {
    console.log('[App Debug] Syncing settings to localStorage...');
    localStorage.setItem('wf_version', layoutVersion);
    localStorage.setItem('wf_theme', themeView);
    localStorage.setItem('wf_offset', rightOffset);
  }, [layoutVersion, themeView, rightOffset]);

  // Auto-close menu timer debug
  useEffect(() => {
    if (!menuOpen) return;
    console.log('[App Debug] ⏱️ Auto-close menu timer started (4s)');
    const timer = setTimeout(() => {
      console.log('[App Debug] ⏱️ Auto-close menu timer triggered');
      setMenuOpen(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [menuOpen]);

  const getThemeStyles = () => {
    if (themeView === 'dark')
      return { backgroundColor: '#121212', color: '#ffffff' };
    if (themeView === 'bw')
      return {
        backgroundColor: '#ffffff',
        color: '#000000',
        filter: 'grayscale(100%)',
      };
    return { backgroundColor: '#f9f9f9', color: '#1a1a1a' };
  };

  const handleSelectTab = (tab) => {
    console.log(`[App Debug] 🎯 Tab select requested: "${tab}"`);
    setActiveTab(tab);
    setMenuOpen(false);
  };

  return (
    <PacesProvider>
      <div
        style={{
          ...getThemeStyles(),
          minHeight: '100vh',
          marginRight: `${rightOffset}px`,
          boxSizing: 'border-box',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Header Bar */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderBottom: '1px solid #ccc',
            position: 'relative',
          }}
        >
          <h1 
            onClick={() => handleSelectTab('monthly')}
            style={{ 
              margin: 0, 
              fontSize: '20px', 
              color: 'var(--text-h, inherit)',
              cursor: 'pointer'
            }}
          >
            {APP_TITLE}
          </h1>
          <button
            onClick={() => {
              console.log(`[App Debug] Toggle menu click -> Next state: ${!menuOpen}`);
              setMenuOpen(!menuOpen);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '24px',
              color: 'var(--text-h, inherit)',
            }}
            aria-label="Options Menu"
          >
            &#9776;
          </button>

          {/* Floating Vertical Dropdown Navigation */}
          {menuOpen && (
            <nav
              style={{
                position: 'absolute',
                top: '100%',
                right: '15px',
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
              <button 
                onClick={() => handleSelectTab('monthly')}
                style={dropdownBtnStyle(themeView)}
              >
                Monthly View
              </button>
              <button 
                onClick={() => handleSelectTab('overview')}
                style={dropdownBtnStyle(themeView)}
              >
                General Overview
              </button>
              <button 
                onClick={() => handleSelectTab('gear')}
                style={dropdownBtnStyle(themeView)}
              >
                Gear
              </button>
              <button 
                onClick={() => handleSelectTab('builder')}
                style={dropdownBtnStyle(themeView)}
              >
                Workout Builder
              </button>
              <button 
                onClick={() => handleSelectTab('daily')}
                style={dropdownBtnStyle(themeView)}
              >
                Daily View
              </button>
              <button 
                onClick={() => handleSelectTab('options')}
                style={dropdownBtnStyle(themeView)}
              >
                Options
              </button>
            </nav>
          )}
        </header>

        {/* View Routing with Debug Logging & Error Boundaries */}
        <main
          style={{
            padding: layoutVersion === 'mobile' ? '10px' : '20px',
            maxWidth: layoutVersion === 'mobile' ? '480px' : '100%',
            margin: '0 auto',
          }}
        >
          {activeTab === 'monthly' && (
            <ErrorBoundary key="monthly" name="Monthly View">
              <WithDebugLog name="MonthlyView">
                <MonthlyView />
              </WithDebugLog>
            </ErrorBoundary>
          )}

          {activeTab === 'overview' && (
            <ErrorBoundary key="overview" name="General Overview">
              <WithDebugLog name="GeneralOverview">
                <GeneralOverview />
              </WithDebugLog>
            </ErrorBoundary>
          )}

          {activeTab === 'gear' && (
            <ErrorBoundary key="gear" name="Gear View">
              <WithDebugLog name="GearView">
                <GearView />
              </WithDebugLog>
            </ErrorBoundary>
          )}

          {activeTab === 'builder' && (
            <ErrorBoundary key="builder" name="Workout Builder">
              <WithDebugLog name="WorkoutBuilder">
                <div>Workout Builder is commented out in imports</div>
              </WithDebugLog>
            </ErrorBoundary>
          )}

          {activeTab === 'daily' && (
            <ErrorBoundary key="daily" name="Daily View">
              <WithDebugLog name="DailyView">
                <DailyView />
              </WithDebugLog>
            </ErrorBoundary>
          )}

          {activeTab === 'options' && (
            <ErrorBoundary key="options" name="Options View">
              <WithDebugLog name="OptionsView">
                <OptionsView
                  layoutVersion={layoutVersion}
                  setLayoutVersion={setLayoutVersion}
                  themeView={themeView}
                  setThemeView={setThemeView}
                  rightOffset={rightOffset}
                  setRightOffset={setRightOffset}
                />
              </WithDebugLog>
            </ErrorBoundary>
          )}
        </main>
      </div>
    </PacesProvider>
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