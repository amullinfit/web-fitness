import React from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const APP_TITLE = 'Web Fitness';

export default function App() {
  console.log('[App Debug] 🚀 Render cycle started.x');

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9f9f9',
        color: '#1a1a1a',
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

      {/* Main Content Area */}
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
  );
}