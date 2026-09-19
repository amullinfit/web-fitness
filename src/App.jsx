import React, { useState, useEffect } from 'react';
import DailyView from './components/DailyView.jsx';
import MonthlyView from './components/MonthlyView.jsx';
import GeneralOverview from './components/GeneralOverview.jsx'; 
import WorkoutsView from './components/WorkoutsView.jsx';
//import WorkoutBuilder from './components/WorkoutBuilder.jsx';
import GearView from './components/GearView.jsx';
import OptionsView from './components/OptionsView.jsx';
import { PacesProvider } from './utils/PacesContext.jsx';

const APP_TITLE = 'Web Fitness'; // Central title configuration

const START_PAGE = 'daily';

export default function App() {
  // Local state per browser instance - default to 'monthly'
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

  // Auto-close menu after 4 seconds if left open
  useEffect(() => {
    if (!menuOpen) return;
    const timer = setTimeout(() => {
      setMenuOpen(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [menuOpen]);

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

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setMenuOpen(false); // Close menu when an option is picked
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
            position: 'relative', // Allows absolute positioning of the dropdown menu
          }}
        >
          <h1 
            onClick={() => handleSelectTab('monthly')}
            style={{ 
              margin: 0, 
              fontSize: '20px', 
              color: 'var(--text-h, inherit)',
              cursor: 'pointer' // Indicates that the title is clickable
            }}
          >
            {APP_TITLE}
          </h1>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
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
                onClick={() => handleSelectTab('workouts')}
                style={dropdownBtnStyle(themeView)}
              >
                Workouts
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

        {/* View Routing */}
        <main
          style={{
            padding: layoutVersion === 'mobile' ? '10px' : '20px',
            maxWidth: layoutVersion === 'mobile' ? '480px' : '100%',
            margin: '0 auto',
          }}
        >
          {activeTab === 'monthly' && <MonthlyView />}
          {activeTab === 'overview' && <GeneralOverview />}
          {activeTab === 'gear' && <GearView />}
{/*          {activeTab === 'builder' && <WorkoutBuilder />} */}
          {activeTab === 'daily' && <DailyView />}
          {activeTab === 'workouts' && <WorkoutsView />}
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
    </PacesProvider>
  );
}
 
// Helper style for clean dropdown option buttons
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