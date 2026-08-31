import React, { useState, useEffect } from 'react';
import DailyView from './components/DailyView';
import OverviewView from './components/OverviewView';
import WorkoutsView from './components/WorkoutsView';
import GearView from './components/GearView';
import OptionsView from './components/OptionsView';


const APP_TITLE = 'Web Fitness'; // Central title configuration

export default function App() {
  // Local state per browser instance
  const [activeTab, setActiveTab] = useState('daily');
  const [menuOpen, setMenuOpen] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(
    localStorage.getItem('wf_version') || 'desktop'
  );
  const [themeView, setThemeView] = useState(
    localStorage.getItem('wf_theme') || 'light'
  );
  const [rightOffset, setRightOffset] = useState(
    Number(localStorage.getItem('wf_offset')) || 0
  );

  useEffect(() => {
    localStorage.setItem('wf_version', layoutVersion);
    localStorage.setItem('wf_theme', themeView);
    localStorage.setItem('wf_offset', rightOffset);
  }, [layoutVersion, themeView, rightOffset]);

  // Apply theme styling
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

  return (
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
          justify: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: '1px solid #ccc',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px' }}>{APP_TITLE}</h1>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '24px',
          }}
          aria-label="Options Menu"
        >
          &#9776;
        </button>
      </header>

      {/* Slideout Navigation / View Selector */}
      {menuOpen && (
        <nav
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid #ccc',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <button onClick={() => setActiveTab('daily')}>Daily View</button>
          <button onClick={() => setActiveTab('overview')}>
            General Overview
          </button>
          <button onClick={() => setActiveTab('workouts')}>Workouts</button>
          <button onClick={() => setActiveTab('gear')}>Gear</button>
          <button onClick={() => setActiveTab('options')}>Options</button>
        </nav>
      )}

      {/* View Routing */}
      <main
        style={{
          padding: layoutVersion === 'mobile' ? '10px' : '20px',
          maxWidth: layoutVersion === 'mobile' ? '480px' : '100%',
          margin: '0 auto',
        }}
      >
        {activeTab === 'daily' && <DailyView />}
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'workouts' && <WorkoutsView />}
        {activeTab === 'gear' && <GearView />}
        {activeTab === 'options' && (
          <OptionsView
            layoutVersion={layoutVersion}
            setLayoutVersion={setLayoutVersion}
            themeView={themeView}
            setThemeView={setThemeView}
            rightOffset={rightOffset}
            setRightOffset={setRightOffset}
          />
        )}
      </main>
    </div>
  );
}
