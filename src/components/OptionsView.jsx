import React from 'react';

export default function OptionsView({ layoutVersion, setLayoutVersion, themeView, setThemeView, rightOffset, setRightOffset }) {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>Dashboard Options</h2>
      
      {/* Layout Selection */}
      <div>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Layout Mode</label>
        <button 
          onClick={() => setLayoutVersion('desktop')} 
          style={{ fontWeight: layoutVersion === 'desktop' ? 'bold' : 'normal', marginRight: '8px' }}
        >
          Desktop
        </button>
        <button 
          onClick={() => setLayoutVersion('mobile')} 
          style={{ fontWeight: layoutVersion === 'mobile' ? 'bold' : 'normal' }}
        >
          Mobile
        </button>
      </div>

      {/* Visual Theme Selection */}
      <div>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Color Theme</label>
        <button onClick={() => setThemeView('light')} style={{ marginRight: '8px' }}>Light</button>
        <button onClick={() => setThemeView('dark')} style={{ marginRight: '8px' }}>Dark</button>
        <button onClick={() => setThemeView('bw')}>Black & White</button>
      </div>

      {/* Right Offset Control */}
      <div>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
          Right-Hand Offset Buffer: {rightOffset}px
        </label>
        <input 
          type="range" 
          min="0" 
          max="500" 
          value={rightOffset} 
          onChange={(e) => setRightOffset(Number(e.target.value))} 
          style={{ width: '100%' }}
        />
      </div>

      <hr style={{ width: '100%', margin: '20px 0' }} />

      {/* About Section */}
      <div>
        <h3>About Web Fitness</h3>
        <p><strong>Started:</strong> August 2026</p>
        <p><strong>Architecture:</strong> Hosted on Vercel via GitHub continuous deployment. Data proxied through Val Town from Intervals.icu and stored in Turso DB.</p>
        <p>Created by Andrew Mullin with a big assist from Gemini.</p>
      </div>
    </div>
  );
}