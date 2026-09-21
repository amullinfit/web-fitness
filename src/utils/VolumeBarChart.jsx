import React from 'react';
import '../css/VolumeBarChart.css';

/**
 * Determines intensity color based on workout steps or average pace/zone.
 * Gray: Z1/Z2 | Yellow: Z3 | Blue: Z4 | Red: Z5+
 */
const getIntensityColor = (workout) => {
  if (!workout) return '#6c757d'; // Gray default
  const intensity = String(workout.intensity || workout.type || '').toLowerCase();
  
  if (intensity.includes('z5') || intensity.includes('sprint') || intensity.includes('vo2')) return '#dc3545'; // Red
  if (intensity.includes('z4') || intensity.includes('threshold')) return '#0d6efd'; // Blue
  if (intensity.includes('z3') || intensity.includes('tempo')) return '#ffc107'; // Yellow
  return '#6c757d'; // Gray for Z1/Z2
};

const getDistanceMiles = (workout) => {
  if (!workout) return 0;
  const distMeters = workout.distance || workout.icu_distance || 0;
  if (distMeters > 0) return distMeters / 1609.34;
  
  // Estimate distance from duration (mins) & pace if missing
  const durationSec = workout.moving_time || workout.elapsed_time || workout.duration || 0;
  if (durationSec > 0) {
    const defaultPaceSec = 480; // 8:00/mi fallback
    return (durationSec / defaultPaceSec);
  }
  return 0;
};

export default function VolumeBarChart({ weekDates, workoutsByDate, sportType = 'Run' }) {
  const dailyData = weekDates.map((date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayWorkouts = (workoutsByDate[dateStr] || []).filter((w) => {
      const type = String(w.type || w.sport || '').toLowerCase();
      if (sportType === 'Run') return type.includes('run');
      if (sportType === 'Bike') return type.includes('ride') || type.includes('bike') || type.includes('cycling');
      return true;
    });

    const totalMiles = dayWorkouts.reduce((sum, w) => sum + getDistanceMiles(w), 0);
    const primaryWorkout = dayWorkouts[0];
    const color = getIntensityColor(primaryWorkout);
    const isOverEightMiles = totalMiles > 8;

    return {
      dateStr,
      dayName: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      miles: totalMiles,
      color,
      isOverEightMiles
    };
  });

  const totalWeeklyMiles = dailyData.reduce((sum, d) => sum + d.miles, 0);
  const maxBarMiles = Math.max(...dailyData.map((d) => d.miles), 10);

  return (
    <div className="volume-chart-week-container">
      <div className="volume-chart-header">
        <span className="volume-chart-sport-tag">{sportType}</span>
        <span className="volume-chart-weekly-total">{totalWeeklyMiles.toFixed(1)} mi total</span>
      </div>

      {/* Outer Enclosing Container representing the Weekly Volume */}
      <div className="volume-chart-weekly-frame">
        <div className="volume-chart-bars-row">
          {dailyData.map((day, idx) => {
            const heightPct = (day.miles / maxBarMiles) * 100;
            return (
              <div key={idx} className="volume-chart-col" title={`${day.dayName}: ${day.miles.toFixed(1)} mi`}>
                <div className="volume-chart-bar-wrapper">
                  <div
                    className={`volume-chart-bar ${day.isOverEightMiles ? 'over-eight-miles' : ''}`}
                    style={{
                      height: `${Math.max(heightPct, day.miles > 0 ? 8 : 0)}%`,
                      backgroundColor: day.isOverEightMiles ? '#6c757d' : day.color
                    }}
                  />
                </div>
                <span className="volume-chart-day-label">{day.dayName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}