import React, { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { PacesProvider, usePaces } from './utils/PacesContext.jsx';

const APP_TITLE = 'Web Fitness';

function HeaderBar() {
  // Destructure `paces` and `loading` matching your PacesContext exports
  const { paces, loading } = usePaces();

  // Debug logging
  useEffect(() => {
    if (loading) {
      console.log('[HeaderBar Debug] ⏳ Pace data is currently loading...');
    } else if (paces) {
      console.log('[HeaderBar Debug] 📊 Pace data loaded successfully:', paces);
    } else {
      console.log('[HeaderBar Debug] ⚠️ Pace data failed to load or is empty.');
    }
  }, [paces, loading]);

  return (
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
        {loading && ' (Loading...)'}
        {!loading && paces?.name && ` - ${paces.name}`}
      </h1>
    </header>
  );
}

export default function App() {
  console.log('[App Debug] 🚀 Render cycle started.');

  return (
    <PacesProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f9f9f9',
          color: '#1a1a1a',
          boxSizing: 'border-box',
          transition: 'all 0.2s ease',
        }}
      >
        <HeaderBar />

        <main
          style={{
            padding: '20px',
            maxWidth: '100%',
            margin: '0 auto',
          }}
        >
          <ErrorBoundary name="Main Container">
            <div>
              <p>No active view selected.</p>
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </PacesProvider>
  );
}