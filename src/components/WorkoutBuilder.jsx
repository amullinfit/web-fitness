import React, { useState } from 'react';
import './WorkoutBuilder.css';

const INTERVALS_API_URL = "https://intervals.icu/api/v1/athlete";

export default function WorkoutBuilder({ athleteId, apiKey }) {
  const [library, setLibrary] = useState([]);
  const [workoutName, setWorkoutName] = useState('');
  const [notes, setNotes] = useState('');
  const [sport, setSport] = useState('Run');
  const [steps, setSteps] = useState([]);

  // Tally Calculations
  const totalDurationSec = steps.reduce((acc, step) => acc + (step.durationSec || 0), 0);
  const totalDistanceMeters = steps.reduce((acc, step) => acc + (step.distanceMeters || 0), 0);

  const handleAddStep = (type) => {
    if (type === 'repeat') {
      // Default repeat: 1 run + 1 recovery interval
      setSteps([
        ...steps,
        {
          isRepeat: true,
          reps: 4,
          steps: [
            { type: 'Run', mode: 'time', durationSec: 300, distanceMeters: 1000, paceSecPerMile: 420 },
            { type: 'Recovery', mode: 'time', durationSec: 120, distanceMeters: 300, paceSecPerMile: 600 }
          ]
        }
      ]);
    } else {
      setSteps([
        ...steps,
        { type, mode: 'time', durationSec: 600, distanceMeters: 1609, paceSecPerMile: 480 }
      ]);
    }
  };

  const handleStepChange = (index, field, value) => {
    const updated = [...steps];
    const step = updated[index];
    step[field] = value;

    // Recalculate Time/Distance if Pace is defined
    if (step.paceSecPerMile && step.paceSecPerMile > 0) {
      if (field === 'durationSec') {
        step.distanceMeters = Math.round((step.durationSec / step.paceSecPerMile) * 1609.34);
      } else if (field === 'distanceMeters') {
        step.durationSec = Math.round((step.distanceMeters / 1609.34) * step.paceSecPerMile);
      }
    }
    setSteps(updated);
  };

  const handleSaveToIntervals = async () => {
    const payload = {
      name: workoutName,
      description: notes,
      type: sport,
      workout_doc: { steps }
    };

    try {
      const res = await fetch(`${INTERVALS_API_URL}/${athleteId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Workout saved successfully to Intervals.icu!');
        setLibrary([...library, payload]);
      }
    } catch (err) {
      console.error('Error saving workout:', err);
    }
  };

  return (
    <div className="workout-builder-container">
      <h2>Intervals.icu Workout Creator</h2>

      <div className="builder-main">
        {/* Form Controls */}
        <div className="builder-form">
          <input
            type="text"
            placeholder="Workout Name"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            className="builder-input"
          />

          <select value={sport} onChange={(e) => setSport(e.target.value)} className="builder-select">
            <option value="Run">Run</option>
            <option value="Ride">Ride / Bike</option>
            <option value="Swim">Swim</option>
          </select>

          <textarea
            placeholder="Workout Notes / Description..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="builder-textarea"
          />

          {/* Step Adders */}
          <div className="step-btn-group">
            <button onClick={() => handleAddStep('Warmup')}>+ Warmup</button>
            <button onClick={() => handleAddStep('Run')}>+ Run</button>
            <button onClick={() => handleAddStep('Recovery')}>+ Recovery</button>
            <button onClick={() => handleAddStep('Cooldown')}>+ Cooldown</button>
            <button onClick={() => handleAddStep('repeat')} className="btn-repeat">+ Repeat Block</button>
          </div>

          {/* Running Tally Display */}
          <div className="running-tally-bar">
            <span><strong>Total Time:</strong> {Math.floor(totalDurationSec / 60)}m {totalDurationSec % 60}s</span>
            <span><strong>Total Distance:</strong> {(totalDistanceMeters / 1609.34).toFixed(2)} miles</span>
          </div>

          {/* Steps List */}
          <div className="builder-steps-list">
            {steps.map((step, idx) => (
              <div key={idx} className="builder-step-card">
                <strong>Step {idx + 1}: {step.type}</strong>
                <div className="step-inline-fields">
                  <select
                    value={step.mode}
                    onChange={(e) => handleStepChange(idx, 'mode', e.target.value)}
                  >
                    <option value="time">By Time</option>
                    <option value="distance">By Distance</option>
                  </select>

                  {step.mode === 'time' ? (
                    <input
                      type="number"
                      placeholder="Seconds"
                      value={step.durationSec}
                      onChange={(e) => handleStepChange(idx, 'durationSec', Number(e.target.value))}
                    />
                  ) : (
                    <input
                      type="number"
                      placeholder="Meters"
                      value={step.distanceMeters}
                      onChange={(e) => handleStepChange(idx, 'distanceMeters', Number(e.target.value))}
                    />
                  )}

                  <input
                    type="number"
                    placeholder="Pace (Sec/Mi)"
                    value={step.paceSecPerMile}
                    onChange={(e) => handleStepChange(idx, 'paceSecPerMile', Number(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSaveToIntervals} className="builder-save-btn">Save to Intervals.icu Library</button>
        </div>
      </div>
    </div>
  );
}