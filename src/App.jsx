import React, { useState, useEffect } from 'react';
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

  // Sync to LocalStorage
  useEffect(() => {
    console.log('[App Debug] Syncing settings to localStorage...');
    localStorage.setItem('wf_version', layoutVersion);
    localStorage.setItem('wf_theme', themeView);
    localStorage.setItem('wf_offset', rightOffset);
  }, [layoutVersion, themeView, rightOffset]);

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
            style={{ 
              margin: 0, 
              fontSize: '20px', 
              color: 'var(--text-h, inherit)',
            }}
          >
            {APP_TITLE}
          </h1>
        </header>

        {/* Main content rendering only OptionsView */}
        <main
          style={{
            padding: layoutVersion === 'mobile' ? '10px' : '20px',
            maxWidth: layoutVersion === 'mobile' ? '480px' : '100%',
            margin: '0 auto',
          }}
        >
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
        </main>
      </div>
    </PacesProvider>
  );
}