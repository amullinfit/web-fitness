import React, { useState, useEffect } from 'react';
import '../CSS/OptionsView.css';
import { usePaces } from './PacesContext'; 

export default function OptionsView({ 
  rightOffset, 
  setRightOffset 
}) {
  const { pacesData, loading } = usePaces();

  // State to hold the dynamic maximum slider value
  const [maxOffset, setMaxOffset] = useState(500);

  useEffect(() => {
    // Function to check screen width and set the max buffer
    const updateMaxOffset = () => {
      const isMobile = window.innerWidth <= 767;
      const newMax = isMobile ? 100 : 500;
      
      setMaxOffset(newMax);

      // If current offset exceeds the new maximum, clamp it down
      if (rightOffset > newMax) {
        setRightOffset(newMax);
      }
    };

    // Run on mount
    updateMaxOffset();

    // Listen for window resizes
    window.addEventListener('resize', updateMaxOffset);
    return () => window.removeEventListener('resize', updateMaxOffset);
  }, [rightOffset, setRightOffset]);

  return (
    <div className="options-container">
      {/* Top Header Bar */}
      <header className="options-header">
        <h1 className="webfitness-title">
          WebFitness Options
          {loading ? (
            <span style={{ fontSize: '16px', fontWeight: 'normal', opacity: 0.7 }}> (Loading...)</span>
          ) : pacesData?.name ? (
            <span style={{ fontSize: '18px', fontWeight: 'normal', marginLeft: '8px' }}> - {pacesData.name}</span>
          ) : null}
        </h1>
      </header>

      <div className="options-content">
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