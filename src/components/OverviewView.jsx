import React, { useState, useEffect } from 'react';

// Replace with your actual Val Town HTTP URL for api_overview
const VAL_OVERVIEW_URL = "https://amullinfit--254cc3a4a4cf11f1a9e41607ee4eb77e.web.val.run";

export default function OverviewView() {
  const [data, setData] = useState({ activities: [], wellness: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_OVERVIEW_URL)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching overview data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading General Overview...</div>;

  const activities = data.activities || [];
  const wellness = data.wellness || [];

  // Calculate Sport Bucket Totals
  const swimTypes = ['Swim', 'Open Water Swim'];
  const bikeTypes = ['Ride', 'Virtual Ride', 'eRide'];
  const runTypes = ['Run', 'Treadmill', 'Virtual Run', 'Hike', 'Snowshoe'];

  let swimYds = 0, bikeMiles = 0, runMiles = 0, workoutCount = 0;

  activities.forEach((act) => {
    const type = act.type;
    const distanceMeters = act.distance || 0;
    if (swimTypes.includes(type)) {
      swimYds += distanceMeters * 1.09361; // meters to yards
    } else if (bikeTypes.includes(type)) {
      bikeMiles += distanceMeters * 0.000621371; // meters to miles
    } else if (runTypes.includes(type)) {
      runMiles += distanceMeters * 0.000621371; // meters to miles
    } else {
      workoutCount += 1;
    }
  });

  // Calculate PopStreak 60-day boxes
  const latest60Wellness = [...wellness].reverse().slice(0, 60);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sport Buckets Template Rendering */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1, border: '1px solid #000', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '6px' }}>Swim</div>
          <div style={{ margin: '4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 'bold', lineHeight: 1 }}>{Math.round(swimYds)}</span>
            <span style={{ fontSize: '12px', fontWeight: 'normal' }}> yds</span>
          </div>
        </div>

        <div style={{ flex: 1, border: '1px solid #000', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '6px' }}>Bike</div>
          <div style={{ margin: '4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 'bold', lineHeight: 1 }}>{bikeMiles.toFixed(1)}</span>
            <span style={{ fontSize: '12px', fontWeight: 'normal' }}> mi</span>
          </div>
        </div>

        <div style={{ flex: 1, border: '1px solid #000', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '6px' }}>Run</div>
          <div style={{ margin: '4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 'bold', lineHeight: 1 }}>{runMiles.toFixed(1)}</span>
            <span style={{ fontSize: '12px', fontWeight: 'normal' }}> mi</span>
          </div>
        </div>

        <div style={{ flex: 1, border: '1px solid #000', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '6px' }}>Workouts</div>
          <div style={{ margin: '4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 'bold', lineHeight: 1 }}>{workoutCount}</span>
            <span style={{ fontSize: '12px', fontWeight: 'normal' }}> total</span>
          </div>
        </div>
      </div>

      {/* Pop & Sugar 60-Day Tracking Row */}
      <div style={{ marginTop: '14px', width: '100%' }}>
        <h3 style={{ fontSize: '12px', color: '#000', fontWeight: 'bold', textAlign: 'center', margin: '0 0 8px 0' }}>
          --- POP AND SUGAR RECAP NOT USED ---
        </h3>
        <div style={{ display: 'flex', gap: '2px', width: '100%', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          {latest60Wellness.map((day, idx) => {
            const val = day.PopStreak || day.popandsugar || 0;
            const bg = val > 0 ? '#bbbbbb' : '#ffffff';
            return (
              <div 
                key={day.id || idx}
                title={`${day.id}: ${val}`}
                style={{ flex: '1 1 0', minWidth: 0, aspectRatio: '1', backgroundColor: bg, border: '1px solid #000000', borderRadius: '1px' }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}