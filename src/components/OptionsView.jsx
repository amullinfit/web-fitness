import React, { useState, useEffect } from 'react';
import '../CSS/OptionsView.css';
import { usePaces } from '../utils/PacesContext.jsx'; 

export default function OptionsView({ 
  rightOffset, 
  setRightOffset 
}) {
  // Destructure `paces` to match PacesContext.jsx
  const { paces, loading } = usePaces();

  // State to hold the dynamic maximum slider value
  const [maxOffset, setMaxOffset] = useState(500);
  const [auth, setAuth] = useState(null);
  const [authError, setAuthError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to check GitHub sign-in.');
        return response.json();
      })
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false, authorized: false }));
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    setAuthError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Unable to sign out.');
      window.location.assign('/');
    } catch (error) {
      setAuthError(error.message);
      setSigningOut(false);
    }
  };

  useEffect(() => {
    // Function to check screen width and set the max buffer
    const updateMaxOffset = () => {
      const isMobile = window.innerWidth <= 767;
      const newMax = isMobile ? 100 : 500;
      
      setMaxOffset(newMax);

      // Clamp down offset using functional state update
      setRightOffset((prevOffset) => (prevOffset > newMax ? newMax : prevOffset));
    };

    // Run on mount
    updateMaxOffset();

    // Listen for window resizes
    window.addEventListener('resize', updateMaxOffset);
    return () => window.removeEventListener('resize', updateMaxOffset);
  }, [setRightOffset]);

  return (
    <div className="options-container">
      {/* Top Header Bar */}
      <header className="options-header">
        <h1 className="webfitness-title">
          WebFitness Options
          {loading ? (
            <span style={{ fontSize: '16px', fontWeight: 'normal', opacity: 0.7 }}> (Loading...)</span>
          ) : paces?.name ? (
            <span style={{ fontSize: '18px', fontWeight: 'normal', marginLeft: '8px' }}> - {paces.name}</span>
          ) : null}
        </h1>
      </header>

      <div className="options-content">
        <h2>GitHub Account</h2>
        <div className="control-section">
          {auth === null ? (
            <p>Checking GitHub sign-in…</p>
          ) : auth.authenticated ? (
            <>
              <p>Signed in as <strong>{auth.login}</strong> — {auth.authorized ? 'Authorized owner (full access unless read-only was requested)' : 'Read-only access'}</p>
              <button type="button" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out of Web Fitness'}</button>
            </>
          ) : (
            <>
              <p>Not signed in to Web Fitness. Read-only access is active.</p>
              <a href="/api/auth/login">Sign in with GitHub</a>
            </>
          )}
          {authError && <p role="alert">{authError}</p>}
        </div>
        <hr className="options-divider" />
        <h2>Dashboard Options</h2>

        {/* Right Offset Control */}
        <div className="control-section">
          <label className="control-label">
            Right-Hand Offset Buffer: {rightOffset}px 
            <span className="control-sublabel"> ({maxOffset === 100 ? 'Mobile View' : 'Desktop View'})</span>
          </label>
          <input 
            type="range" 
            min="0" 
            max={maxOffset} 
            value={rightOffset} 
            onChange={(e) => setRightOffset(Number(e.target.value))} 
            className="offset-slider"
          />
        </div>

        <hr className="options-divider" />

        {/* About Section */}
        <div className="about-section">
          <h3>About Web Fitness</h3>
          <p><strong>Started:</strong> August 2026</p>
          <p><strong>Architecture:</strong> Hosted on Vercel via GitHub continuous deployment. Data proxied through Val Town from Intervals.icu and stored in Turso DB.</p>
          <p>Created by Andrew Mullin with a big assist from Gemini.</p>
        </div>
      </div>
    </div>
  );
}