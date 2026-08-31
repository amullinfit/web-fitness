import React, { useState, useEffect } from 'react';

export default function OptionsView({ options, onSaveOptions }) {
  const [athleteId, setAthleteId] = useState(options?.athleteId || '');
  const [popStreakField, setPopStreakField] = useState(options?.popStreakField || 'PopStreak');
  const [useImperial, setUseImperial] = useState(options?.useImperial ?? true);
  const [showCharts, setShowCharts] = useState(options?.showCharts ?? true);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (options) {
      setAthleteId(options.athleteId || '');
      setPopStreakField(options.popStreakField || 'PopStreak');
      setUseImperial(options.useImperial ?? true);
      setShowCharts(options.showCharts ?? true);
    }
  }, [options]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedOptions = {
      athleteId,
      popStreakField,
      useImperial,
      showCharts
    };
    
    if (onSaveOptions) {
      onSaveOptions(updatedOptions);
    }
    
    setStatusMessage('Settings successfully saved!');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  return (
    <div 
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        paddingTop: '100px', 
        paddingLeft: '20px',
        paddingRight: '20px',
        boxSizing: 'border-box'
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>App Settings & Configuration</h2>
      
      {statusMessage && (
        <div style={{ padding: '10px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', marginBottom: '16px' }}>
          {statusMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Athlete ID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="athleteId" style={{ fontWeight: 'bold', fontSize: '14px' }}>
            Intervals.icu Athlete ID
          </label>
          <input
            id="athleteId"
            type="text"
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            placeholder="e.g. i12345"
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>

        {/* Custom Wellness Field Key */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="popStreakField" style={{ fontWeight: 'bold', fontSize: '14px' }}>
            Wellness Field Name (PopStreak Key)
          </label>
          <input
            id="popStreakField"
            type="text"
            value={popStreakField}
            onChange={(e) => setPopStreakField(e.target.value)}
            placeholder="PopStreak"
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>Must match your Intervals.icu custom wellness field key exactly (PascalCase).</span>
        </div>

        {/* Display Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={useImperial}
              onChange={(e) => setUseImperial(e.target.checked)}
            />
            Use Imperial Units (Miles / Yards)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showCharts}
              onChange={(e) => setShowCharts(e.target.checked)}
            />
            Render Workout Charts by Default
          </label>
        </div>

        <button
          type="submit"
          style={{
            alignSelf: 'flex-start',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          Save Configuration
        </button>
      </form>
    </div>
  );
}