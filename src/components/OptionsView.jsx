import React, { useState, useEffect } from 'react';

// Replace with your actual Val Town HTTP URL if loading/saving remote config
const VAL_CONFIG_URL = "https://andrewmullin-api_config.web.val.run";

export default function OptionsView({ options, onSaveOptions }) {
  const [athleteId, setAthleteId] = useState(options?.athleteId || '');
  const [apiKey, setApiKey] = useState(options?.apiKey || '');
  const [popStreakField, setPopStreakField] = useState(options?.popStreakField || 'PopStreak');
  const [useImperial, setUseImperial] = useState(options?.useImperial ?? true);
  const [showCharts, setShowCharts] = useState(options?.showCharts ?? true);
  const [overviewWeeks, setOverviewWeeks] = useState(options?.overviewWeeks || 25);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (options) {
      setAthleteId(options.athleteId || '');
      setApiKey(options.apiKey || '');
      setPopStreakField(options.popStreakField || 'PopStreak');
      setUseImperial(options.useImperial ?? true);
      setShowCharts(options.showCharts ?? true);
      setOverviewWeeks(options.overviewWeeks || 25);
    }
  }, [options]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: '', message: '' });

    const payload = {
      athleteId,
      apiKey,
      popStreakField,
      useImperial,
      showCharts,
      overviewWeeks: Number(overviewWeeks)
    };

    try {
      // Optional: Save directly to remote Val Town backend storage if endpoint active
      if (VAL_CONFIG_URL) {
        await fetch(VAL_CONFIG_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      // Propagate options back to App state
      if (onSaveOptions) {
        onSaveOptions(payload);
      }

      setStatus({ type: 'success', message: 'Settings saved successfully!' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setStatus({ type: 'error', message: 'Failed to persist settings. Updated locally.' });
      if (onSaveOptions) onSaveOptions(payload);
    } finally {
      setSaving(false);
      setTimeout(() => setStatus({ type: '', message: '' }), 4000);
    }
  };

  return (
    <div 
      style={{
        maxWidth: '650px',
        margin: '0 auto',
        paddingTop: '100px', 
        paddingLeft: '20px',
        paddingRight: '20px',
        boxSizing: 'border-box'
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Dashboard Configuration</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
        Manage backend API endpoints, custom field mappings, and dashboard preferences.
      </p>

      {status.message && (
        <div 
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '20px',
            backgroundColor: status.type === 'error' ? '#f8d7da' : '#d4edda',
            color: status.type === 'error' ? '#721c24' : '#155724',
            border: `1px solid ${status.type === 'error' ? '#f5c6cb' : '#c3e6cb'}`
          }}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Credentials Section */}
        <fieldset style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <legend style={{ fontWeight: 'bold', padding: '0 6px', fontSize: '14px' }}>API Credentials</legend>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="athleteId" style={{ fontWeight: '600', fontSize: '13px' }}>
              Intervals.icu Athlete ID
            </label>
            <input
              id="athleteId"
              type="text"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              placeholder="e.g. i12345"
              style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="apiKey" style={{ fontWeight: '600', fontSize: '13px' }}>
              Intervals.icu API Key (Optional Override)
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank to use Val Town ENV VAR"
              style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        </fieldset>

        {/* Custom Mappings Section */}
        <fieldset style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <legend style={{ fontWeight: 'bold', padding: '0 6px', fontSize: '14px' }}>Custom Field Mappings</legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="popStreakField" style={{ fontWeight: '600', fontSize: '13px' }}>
              Wellness Streak Field Key
            </label>
            <input
              id="popStreakField"
              type="text"
              value={popStreakField}
              onChange={(e) => setPopStreakField(e.target.value)}
              placeholder="PopStreak"
              style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <span style={{ fontSize: '12px', color: '#666' }}>Must match your custom field key in Intervals.icu (e.g., PascalCase <code>PopStreak</code>).</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="overviewWeeks" style={{ fontWeight: '600', fontSize: '13px' }}>
              Overview Consistency Window (Weeks)
            </label>
            <input
              id="overviewWeeks"
              type="number"
              min="4"
              max="52"
              value={overviewWeeks}
              onChange={(e) => setOverviewWeeks(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        </fieldset>

        {/* Interface Preferences Section */}
        <fieldset style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <legend style={{ fontWeight: 'bold', padding: '0 6px', fontSize: '14px' }}>Display Preferences</legend>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={useImperial}
              onChange={(e) => setUseImperial(e.target.checked)}
            />
            Use Imperial Units (Miles / Yards)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showCharts}
              onChange={(e) => setShowCharts(e.target.checked)}
            />
            Render Highcharts Structured Workout Visualizations
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          style={{
            alignSelf: 'flex-start',
            padding: '10px 24px',
            backgroundColor: saving ? '#6c757d' : '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {saving ? 'Saving Changes...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}