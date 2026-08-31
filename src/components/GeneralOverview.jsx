import React, { useState, useEffect } from 'react';

const VAL_WORKOUTS_URL = "https://amullinfit--a89d6420a4cf11f1ad761607ee4eb77e.web.val.run";

// --- DATE HELPER UTILITIES ---

// Get Monday of a given date's week
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Add/Subtract days
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Format Date to "MMM D" (e.g., "Aug 31")
const formatMMMD = (d) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Format Date to "MMM YYYY" (e.g., "Aug 2026")
  const formatMMMYYYY = (d) => {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  
// Comparison indicator arrow
const RenderIndicator = ({ current, previous }) => {
  if (current > previous) return <span style={{ color: '#28a745', marginLeft: '6px' }}>▲</span>;
  if (current < previous) return <span style={{ color: '#dc3545', marginLeft: '6px' }}>▼</span>;
  return <span style={{ color: '#6c757d', marginLeft: '6px' }}>►</span>;
};

export default function GeneralOverview({ overviewData }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_WORKOUTS_URL)
      .then((res) => res.json())
      .then((json) => {
        if (json) {
          const list = Array.isArray(json.workouts) ? json.workouts : (Array.isArray(json) ? json : []);
          setWorkouts(list);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching overview data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', color: '#6c757d' }}>Loading overview data...</div>;
  }

  // --- DATA PROCESSING LOGIC ---

  const now = new Date();
  const currentMon = getMonday(now);
  const currentSun = addDays(currentMon, 6); currentSun.setHours(23, 59, 59, 999);

  const priorMon = addDays(currentMon, -7);
  const priorSun = addDays(priorMon, 6); priorSun.setHours(23, 59, 59, 999);

  // Normalize workouts with parsed dates
  const parsedWorkouts = workouts.map((w) => {
    const rawDate = w.start_date_local || w.icu_start_date || w.start_date;
    const dateObj = rawDate ? new Date(rawDate) : new Date();
    const type = w.type || w.sport || 'Run';
    const distanceMiles = w.distance ? w.distance * 0.000621371 : 0;
    const isRace = w.is_race || w.race || (w.name && w.name.toLowerCase().includes('race'));

    return {
      ...w,
      dateObj,
      type,
      distanceMiles,
      isRace
    };
  });

  // 1. WEEKLY BUCKETS & ANNUAL TABLES DATA
  const sportCategories = ['Run', 'Bike', 'Swim'];
  const buckets = sportCategories.map((sport) => {
    const sportWorkouts = parsedWorkouts.filter(w => w.type.toLowerCase() === sport.toLowerCase());

    // Cur week distance
    const curWeekVal = sportWorkouts
      .filter(w => w.dateObj >= currentMon && w.dateObj <= currentSun)
      .reduce((acc, w) => acc + w.distanceMiles, 0);

    // Prev week distance
    const prevWeekVal = sportWorkouts
      .filter(w => w.dateObj >= priorMon && w.dateObj <= priorSun)
      .reduce((acc, w) => acc + w.distanceMiles, 0);

    // Annualized tables (Current Year vs Prior Year)
    const currentYear = now.getFullYear();
    const priorYear = currentYear - 1;

    const annualData = [currentYear, priorYear].map((yr) => {
      const yrWorkouts = sportWorkouts.filter(w => w.dateObj.getFullYear() === yr);
      const yrDist = yrWorkouts.reduce((acc, w) => acc + w.distanceMiles, 0);
      return {
        year: String(yr),
        total: sport === 'Swim' ? `${Math.round(yrDist * 1609.34)}m` : `${yrDist.toFixed(1)} mi`,
        count: yrWorkouts.length
      };
    });

    const isSwim = sport === 'Swim';
    return {
      type: sport,
      currentWeekDist: isSwim ? `${Math.round(curWeekVal * 1609.34)}m` : `${curWeekVal.toFixed(1)} mi`,
      currentWeekVal: curWeekVal,
      prevWeekDist: isSwim ? `${Math.round(prevWeekVal * 1609.34)}m` : `${prevWeekVal.toFixed(1)} mi`,
      prevWeekVal: prevWeekVal,
      annualTable: annualData
    };
  });

  // 2. WEEKLY ACTIVITY GRIDS (Current vs Prior Week)
  const buildGridWeek = (monDate, sunDate) => {
    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let actCount = 0;
    for (let i = 0; i < 7; i++) {
      const dayStart = addDays(monDate, i);
      const dayEnd = addDays(dayStart, 0);
      dayEnd.setHours(23, 59, 59, 999);

      const dayWorkouts = parsedWorkouts.filter(w => w.dateObj >= dayStart && w.dateObj <= dayEnd);
      actCount += dayWorkouts.length;

      days.push({
        day: dayNames[i],
        count: dayWorkouts.length,
        items: dayWorkouts.map(w => ({
          type: w.type,
          distance: w.type.toLowerCase() === 'swim' 
            ? `${Math.round(w.distanceMiles * 1609.34)}m`
            : `${w.distanceMiles.toFixed(1)} mi`
        }))
      });
    }

    return {
      range: `${formatMMMD(monDate)} - ${formatMMMD(sunDate)}`,
      totalActivities: actCount,
      days
    };
  };

  const currentWeekGrid = buildGridWeek(currentMon, currentSun);
  const priorWeekGrid = buildGridWeek(priorMon, priorSun);

  // 3. CONSISTENCY GRID DATA (7 rows x 61 columns)
  // Generating 61 weeks: index 60 is current week, index 0 is 60 weeks ago
  const consistencyWeeks = [];
  for (let w = 60; w >= 0; w--) {
    const weekMon = addDays(currentMon, -w * 7);
    const weekDays = [];

    for (let d = 0; d < 7; d++) {
      const dayStart = addDays(weekMon, d);
      const dayEnd = addDays(dayStart, 0);
      dayEnd.setHours(23, 59, 59, 999);

      const dayWorkouts = parsedWorkouts.filter(w => w.dateObj >= dayStart && w.dateObj <= dayEnd);
      const hasRace = dayWorkouts.some(w => w.isRace);

      weekDays.push({
        count: dayWorkouts.length,
        isRace: hasRace
      });
    }
    consistencyWeeks.push(weekDays);
  }

  // 4. MONTHLY RUN TOTALS (Last 13 Months)
  const monthlyRunTotals = [];
  for (let m = 12; m >= 0; m--) {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

    const runDist = parsedWorkouts
      .filter(w => w.type.toLowerCase() === 'run' && w.dateObj >= monthStart && w.dateObj <= monthEnd)
      .reduce((acc, w) => acc + w.distanceMiles, 0);

    monthlyRunTotals.push({
      month: formatMMMYYYY(targetMonth),
      distance: '${runDist.toFixed(1)} mi'
    });
  }

  // Helper render for Weekly Grids
  const renderWeekGrid = (gridData, title) => (
    <div style={{ marginBottom: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px', backgroundColor: '#fff' }}>
      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>
        {title}: {gridData.range} ({gridData.totalActivities} activities)
      </div>
      
      {/* 7 Days Header Boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }}>
        {gridData.days.map((d, idx) => {
          let bgColor = '#ffffff';
          let textColor = '#212529';
          if (d.count === 1) { bgColor = '#adb5bd'; textColor = '#fff'; }
          else if (d.count >= 2) { bgColor = '#212529'; textColor = '#fff'; }

          return (
            <div key={idx} style={{
              backgroundColor: bgColor,
              color: textColor,
              border: '1px solid #ced4da',
              borderRadius: '4px',
              padding: '6px',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '12px'
            }}>
              {d.day} ({d.count})
            </div>
          );
        })}
      </div>

      {/* Activities Breakdown per Day */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {gridData.days.map((d, idx) => (
          <div key={idx} style={{ fontSize: '11px', color: '#495057' }}>
            {d.items.length === 0 ? (
              <span style={{ color: '#ced4da' }}>—</span>
            ) : (
              d.items.map((item, iIdx) => {
                const isTriSport = ['swim', 'bike', 'run'].includes(item.type.toLowerCase());
                return (
                  <div key={iIdx} style={{ marginBottom: '2px' }}>
                    {isTriSport ? `${item.type} ${item.distance || ''}` : item.type}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px' }}>
      
      {/* SECTION 1: WEEKLY BUCKETS & ANNUAL TABLES */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {buckets.map((b, idx) => (
          <div key={idx} style={{ flex: '1', minWidth: '280px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{b.type}</div>
            
            <div style={{ fontSize: '28px', fontWeight: 'bold', margin: '8px 0 4px 0', color: '#111' }}>
              {b.currentWeekDist}
            </div>

            <div style={{ fontSize: '13px', color: '#6c757d', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
              Prev Week: {b.prevWeekDist}
              <RenderIndicator current={b.currentWeekVal} previous={b.prevWeekVal} />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#6c757d', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: '4px', borderBottom: '1px solid #ced4da', fontWeight: '600' }}>Year</th>
                  <th style={{ textAlign: 'center', paddingBottom: '4px', borderBottom: '1px solid #ced4da', fontWeight: '600', paddingLeft: '8px', paddingRight: '8px' }}>Total</th>
                  <th style={{ textAlign: 'right', paddingBottom: '4px', borderBottom: '1px solid #ced4da', fontWeight: '600' }}>#</th>
                </tr>
              </thead>
              <tbody>
                {b.annualTable.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td style={{ padding: '4px 0' }}>{row.year}</td>
                    <td style={{ textAlign: 'center', padding: '4px 8px' }}>{row.total}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0' }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* SECTION 2: WEEKLY ACTIVITY GRIDS */}
      <div>
        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Weekly Activity Grids</h3>
        {renderWeekGrid(currentWeekGrid, "Current Week")}
        {renderWeekGrid(priorWeekGrid, "Prior Week")}
      </div>

      {/* SECTION 3: CONSISTENCY GRID */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', backgroundColor: '#fff', overflowX: 'auto' }}>
        <h3 style={{ fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', color: '#495057', marginTop: 0, marginBottom: '16px', textAlign: 'center' }}>
          --- CONSISTENCY GRID ---
        </h3>

        <div style={{ display: 'flex', gap: '0px', alignItems: 'center' }}>
          {/* Day Labels */}
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gap: '3px', paddingRight: '6px', fontSize: '9px', color: '#6c757d', fontWeight: 'bold' }}>
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>

          {/* 61 Columns of Weeks */}
          <div style={{ display: 'flex' }}>
            {consistencyWeeks.map((week, wIdx) => {
              const isCurrentWeek = wIdx === 60;
              const hasFourWeekDivider = (60 - wIdx) % 4 === 0 && wIdx !== 60;

              return (
                <div key={wIdx} style={{ display: 'flex' }}>
                  {(isCurrentWeek || hasFourWeekDivider) && (
                    <div style={{ width: '1px', backgroundColor: isCurrentWeek ? '#0d6efd' : '#ced4da', margin: '0 2px' }} />
                  )}

                  <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gap: '3px', margin: '0 1px' }}>
                    {week.map((day, dIdx) => {
                      let bgColor = '#ffffff';
                      if (day.count === 1) bgColor = '#adb5bd';
                      else if (day.count >= 2) bgColor = '#212529';

                      if (day.isRace) {
                        return (
                          <div
                            key={dIdx}
                            title="Race Day"
                            style={{
                              width: '12px',
                              height: '12px',
                              border: '1px solid #ced4da',
                              boxSizing: 'border-box',
                              background: 'linear-gradient(135deg, #0d6efd 50%, #ffffff 50%)'
                            }}
                          />
                        );
                      }

                      return (
                        <div
                          key={dIdx}
                          style={{
                            width: '12px',
                            height: '12px',
                            backgroundColor: bgColor,
                            border: '1px solid #ced4da',
                            boxSizing: 'border-box'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: MONTHLY RUN TOTALS */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', backgroundColor: '#fff' }}>
        <h3 style={{ fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase', color: '#495057', marginTop: 0, marginBottom: '16px' }}>
          MONTHLY RUN TOTALS
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
          {monthlyRunTotals.map((item, mIdx) => (
            <div key={mIdx} style={{ padding: '10px', border: '1px solid #e9ecef', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
              <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: '600' }}>{item.month}</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#212529', marginTop: '4px' }}>{item.distance}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}