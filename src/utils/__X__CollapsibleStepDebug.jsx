import React, { useState } from 'react';

export default function CollapsibleStepDebug({ workout }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workout) {
    return (
      <div style={{ padding: '10px', color: '#6c757d', fontSize: '12px' }}>
        No workout selected for step debugging.
      </div>
    );
  }

  // Handle varying API payload key structures (icu_steps, steps, or parsed_steps)
  const steps = workout.icu_steps || workout.steps || workout.parsed_steps || [];

  return (
    <div style={{ marginTop: '16px', border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          padding: '10px 14px',
          backgroundColor: '#f8f9fa',
          border: 'none',
          borderBottom: isOpen ? '1px solid #dee2e6' : 'none',
          textAlign: 'left',
          fontWeight: '600',
          fontSize: '13px',
          color: '#343a40',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>
          🐛 Step Debug Inspector ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
        </span>
        <span>{isOpen ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {/* Collapsible Content Area */}
      {isOpen && (
        <div style={{ padding: '14px', backgroundColor: '#ffffff' }}>
          {steps.length === 0 ? (
            <div style={{ color: '#6c757d', fontSize: '12px', italic: 'true' }}>
              No structured steps found on this workout object.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {steps.map((step, idx) => {
                const duration = step.duration || step.elapsed_time || step.seconds || 0;
                const type = step.type || step.category || 'Step';
                const targetPace = step.target_pace || step.pace || step.intensity || 'N/A';

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderLeft: '4px solid #0d6efd',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#212529' }}>
                      Step #{idx + 1}: {type}
                    </div>
                    <div style={{ color: '#495057', marginTop: '2px' }}>
                      Duration: {Math.floor(duration / 60)}m {duration % 60}s | Target: {targetPace}
                    </div>

                    {/* Raw step key/value inspector */}
                    <details style={{ marginTop: '6px' }}>
                      <summary style={{ cursor: 'pointer', color: '#6c757d', fontSize: '11px' }}>
                        Raw JSON Payload
                      </summary>
                      <pre style={{ margin: '4px 0 0 0', padding: '6px', backgroundColor: '#e9ecef', borderRadius: '4px', fontSize: '10px', overflowX: 'auto' }}>
                        {JSON.stringify(step, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}