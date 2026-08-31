import React, { useState } from 'react';

export default function CollapsibleStepDebug({ debugSteps, thresholdPaceStr, sportType, formatDuration }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginTop: '12px', border: '1px solid #e9ecef', borderRadius: '6px', backgroundColor: '#f8f9fa', overflow: 'hidden' }}>
      {/* Clickable Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isOpen ? '#eef2f6' : '#f8f9fa'
        }}
      >
        <div style={{ fontSize: '13px', color: '#495057' }}>
          <span style={{ fontWeight: 'bold' }}>
            {isOpen ? '▼' : '►'} Steps ({debugSteps.length})
          </span>
          <span style={{ marginLeft: '12px', color: '#0d6efd', fontWeight: '600' }}>
            Threshold Pace: {thresholdPaceStr}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#6c757d', fontStyle: 'italic' }}>
          {isOpen ? 'Click to collapse' : 'Click to expand'}
        </span>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div style={{ padding: '12px 14px 14px 14px', borderTop: '1px solid #e9ecef', backgroundColor: '#fff' }}>
          {debugSteps.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#6c757d' }}>No parsed step data available in workout_doc.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#212529' }}>
              {debugSteps.map((step, sIdx) => (
                <li key={sIdx} style={{ marginBottom: '6px' }}>
                  <strong>{step.name}</strong> — Intensity: <code>{step.intensity}</code> | Target Pace: <code>{step.paceStr}</code> | Duration: <code>{formatDuration(step.durationSec)}</code>
                  <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '1px' }}>
                    Text: "{step.text}"
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}