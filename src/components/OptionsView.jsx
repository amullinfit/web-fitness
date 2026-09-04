import React from 'react';
import './OptionsView.css';

export default function OptionsView({ 
  layoutVersion, 
  setLayoutVersion, 
  themeView, 
  setThemeView, 
  rightOffset, 
  setRightOffset 
}) {
  return (
    <div className="options-container">
      {/* Top Header Bar */}
      <header className="options-header">
        <h1 className="webfitness-title">WebFitness</h1>
        
        {/* Right-Aligned Options Menu */}
        <div className="options-menu">
          <div className="menu-group">
            <label htmlFor="layout-select" className="menu-label">Layout:</label>
            <select 
              id="layout-select"
              value={layoutVersion} 
              onChange={(e) => setLayoutVersion(e.target.value)}
              className="menu-select"
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>

          <div className="menu-group">
            <label htmlFor="theme-select" className="menu-label">Theme:</label>
            <select 
              id="theme-select"
              value={themeView} 
              onChange={(e) => setThemeView(e.target.value)}
              className="menu-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="bw">Black & White</option>
            </select>
          </div>
        </div>
      </header>

      <div className="options-content">
        <h2>Dashboard Options</h2>

        {/* Right Offset Control */}
        <div className="control-section">
          <label className="control-label">
            Right-Hand Offset Buffer: {rightOffset}px
          </label>
          <input 
            type="range" 
            min="0" 
            max="500" 
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