import React, { useState, useEffect } from 'react';
import './GeneralOverview.css';

const VAL_OVERVIEW_URL = "/api/val-overview";

// --- DATE HELPER UTILITIES ---

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatMMMD = (d) => {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMMMYYYY = (d) => {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const RenderIndicator = ({ current, previous }) => {
  if (current > previous) return <span className="indicator-up">▲</span>;
  if (current < previous) return <span className="indicator-down">▼</span>;
  return <span className="indicator-same">►</span>;
};

export default function GeneralOverview({ overviewData }) {
  const [workouts, setWorkouts] = useState([]);
  const [wellness, setWellness] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(VAL_OVERVIEW_URL)
      .then((res) => res.json())
      .then((json) => {
        if (json) {
          const workoutList = json.activities || json.workouts || (Array.isArray(json) ? json : []);
          setWorkouts(workoutList);

          const wellnessList = json.wellness || [];
          setWellness(wellnessList);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching overview data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="overview-loading">Loading overview data...</div>;
  }

  // --- DATA PROCESSING LOGIC ---

  const now = new Date();
  const currentMon = getMonday(now);
  const currentSun = addDays(currentMon, 6); currentSun.setHours(23, 59, 59, 999);

  const priorMon = addDays(currentMon, -7);
  const priorSun = addDays(priorMon, 6); priorSun.setHours(23, 59, 59, 999);

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

    const curWeekVal = sportWorkouts
      .filter(w => w.dateObj >= currentMon && w.dateObj <= currentSun)
      .reduce((acc, w) => acc + w.distanceMiles, 0);

    const prevWeekVal = sportWorkouts
      .filter(w => w.dateObj >= priorMon && w.dateObj <= priorSun)
      .reduce((acc, w) => acc + w.distanceMiles, 0);

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
      distance: `${runDist.toFixed(1)} mi`
    });
  }

  // Helper render for Weekly Grids
  const renderWeekGrid = (gridData, title) => (
    <div className="weekly-grid-card">
      <div className="weekly-grid-header">
        {title}: {gridData.range} ({gridData.totalActivities} activities)
      </div>
      
      {/* 7 Days Header Boxes */}
      <div className="weekly-grid-headers-row">
        {gridData.days.map((d, idx) => {
          let countClass = 'count-0';
          if (d.count === 1) countClass = 'count-1';
          else if (d.count >= 2) countClass = 'count-2plus';

          return (
            <div key={idx} className={`weekly-day-header ${countClass}`}>
              {d.day}
            </div>
          );
        })}
      </div>

      {/* Activities Breakdown per Day */}
      <div className="weekly-grid-items-row">
        {gridData.days.map((d, idx) => (
          <div key={idx} className="weekly-day-column">
            {d.items.length === 0 ? (
              <span className="empty-day-dash">—</span>
            ) : (
              d.items.map((item, iIdx) => {
                const isTriSport = ['swim', 'bike', 'run'].includes(item.type.toLowerCase());
                return (
                  <div key={iIdx} className="activity-item">
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
    <div className="overview-container">
      
      {/* SECTION 1: WEEKLY BUCKETS & ANNUAL TABLES */}
      <div className="sport-buckets-container">
        {buckets.map((b, idx) => (
          <div key={idx} className="sport-bucket-card">
            <div className="sport-bucket-title">{b.type}</div>
            
            <div className="sport-bucket-dist">{b.currentWeekDist}</div>

            <div className="sport-bucket-prev">
              Prev Week: {b.prevWeekDist}
              <RenderIndicator current={b.currentWeekVal} previous={b.prevWeekVal} />
            </div>

            <table className="annual-table">
              <thead>
                <tr>
                  <th className="col-year">Year</th>
                  <th className="col-total">Total</th>
                  <th className="col-count">#</th>
                </tr>
              </thead>
              <tbody>
                {b.annualTable.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="col-year">{row.year}</td>
                    <td className="col-total">{row.total}</td>
                    <td className="col-count">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* SECTION 2: WEEKLY ACTIVITY GRIDS */}
      <div>
        <h3 className="section-title">Weekly Activity Grids</h3>
        {renderWeekGrid(currentWeekGrid, "Current Week")}
        {renderWeekGrid(priorWeekGrid, "Prior Week")}
      </div>

      {/* SECTION 3: CONSISTENCY GRID */}
      <div className="consistency-card">
        <h3 className="section-subtitle-center">
          --- CONSISTENCY GRID ---
        </h3>

        <div className="consistency-grid-wrapper">
          <div className="consistency-day-labels">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>

          <div className="consistency-weeks-container">
            {consistencyWeeks.map((week, wIdx) => {
              const isCurrentWeek = wIdx === 60;
              const hasFourWeekDivider = (60 - wIdx) % 4 === 0 && wIdx !== 60;

              return (
                <div key={wIdx} className="consistency-week-group">
                  {(isCurrentWeek || hasFourWeekDivider) && (
                    <div className={`consistency-divider ${isCurrentWeek ? 'current-week' : ''}`} />
                  )}

                  <div className="consistency-week-column">
                    {week.map((day, dIdx) => {
                      let countClass = 'count-0';
                      if (day.count === 1) countClass = 'count-1';
                      else if (day.count >= 2) countClass = 'count-2plus';

                      return (
                        <div
                          key={dIdx}
                          title={day.isRace ? "Race Day" : undefined}
                          className={`consistency-cell ${countClass} ${day.isRace ? 'race-cell' : ''}`}
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
      <div className="monthly-card">
        <h3 className="section-subtitle">
          MONTHLY RUN TOTALS
        </h3>

        <div className="monthly-grid">
          {monthlyRunTotals.map((item, mIdx) => (
            <div key={mIdx} className="monthly-item">
              <div className="monthly-item-month">{item.month}</div>
              <div className="monthly-item-distance">{item.distance}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}