import React, { useState, useEffect } from 'react';
import './GeneralOverview.css';

const VAL_OVERVIEW_URL = "/api/val-overview";

// --- SPORT CATEGORY MAPPING HELPERS ---

const SWIM_TYPES = new Set(['swim', 'openwaterswim']);
const BIKE_TYPES = new Set(['ride', 'virtualride']);
const RUN_TYPES = new Set(['run', 'virtualrun', 'trailrun', 'hike', 'walk', 'virtualwalk', 'snowshoe']);

const getCategory = (rawType) => {
  if (!rawType) return null;
  const lower = rawType.toLowerCase();
  if (SWIM_TYPES.has(lower)) return 'Swim';
  if (BIKE_TYPES.has(lower)) return 'Bike';
  if (RUN_TYPES.has(lower)) return 'Run';
  return null;
};

// --- UNIT FORMATTING HELPERS ---

const formatSwimYards = (meters) => {
  const yards = meters * 1.09361;
  const kYards = yards / 1000;
  return `${kYards.toFixed(1)}k yd`;
};

const formatSportTotal = (sport, distanceMiles, rawMeters) => {
  if (sport === 'Swim') {
    return formatSwimYards(rawMeters);
  }
  return `${Math.round(distanceMiles)} mi`;
};

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
    const rawType = w.type || w.sport || 'Run';
    const category = getCategory(rawType);
    const rawMeters = w.distance || 0;
    const distanceMiles = rawMeters * 0.000621371;
    const isRace = w.is_race || w.race || (w.name && w.name.toLowerCase().includes('race'));

    return {
      ...w,
      dateObj,
      rawType,
      category,
      name: w.name || '',
      rawMeters,
      distanceMiles,
      isRace
    };
  });

  // 1. WEEKLY BUCKETS & ANNUAL TABLES DATA
  const sportCategories = ['Swim', 'Bike', 'Run'];
  const buckets = sportCategories.map((sport) => {
    const sportWorkouts = parsedWorkouts.filter(w => w.category === sport);

    const curWeekWorkouts = sportWorkouts.filter(w => w.dateObj >= currentMon && w.dateObj <= currentSun);
    const curWeekVal = curWeekWorkouts.reduce((acc, w) => acc + w.distanceMiles, 0);
    const curWeekMeters = curWeekWorkouts.reduce((acc, w) => acc + w.rawMeters, 0);

    const prevWeekWorkouts = sportWorkouts.filter(w => w.dateObj >= priorMon && w.dateObj <= priorSun);
    const prevWeekVal = prevWeekWorkouts.reduce((acc, w) => acc + w.distanceMiles, 0);
    const prevWeekMeters = prevWeekWorkouts.reduce((acc, w) => acc + w.rawMeters, 0);

    const currentYear = now.getFullYear();
    const priorYear = currentYear - 1;

    const annualData = [currentYear, priorYear].map((yr) => {
      const yrWorkouts = sportWorkouts.filter(w => w.dateObj.getFullYear() === yr);
      const yrDistMiles = yrWorkouts.reduce((acc, w) => acc + w.distanceMiles, 0);
      const yrMeters = yrWorkouts.reduce((acc, w) => acc + w.rawMeters, 0);

      return {
        year: String(yr),
        activitiesCount: yrWorkouts.length,
        total: formatSportTotal(sport, yrDistMiles, yrMeters)
      };
    });

    return {
      type: sport,
      currentWeekDist: formatSportTotal(sport, curWeekVal, curWeekMeters),
      currentWeekVal: curWeekVal,
      prevWeekDist: formatSportTotal(sport, prevWeekVal, prevWeekMeters),
      prevWeekVal: prevWeekVal,
      annualTable: annualData
    };
  });

  // 2. WEEKLY ACTIVITY GRIDS
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
        items: dayWorkouts.map(w => {
          const isWeight = w.rawType.toLowerCase() === 'weighttraining';
          const displayLabel = isWeight ? (w.name || w.rawType) : w.rawType;

          return {
            category: w.category,
            displayLabel,
            distance: formatSportTotal(w.category, w.distanceMiles, w.rawMeters)
          };
        })
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

  // 3. CONSISTENCY GRID DATA
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

  // 4 & 5. MONTHLY TOTALS
  const buildMonthlyTotals = (sportCategory) => {
    const monthlyTotals = [];
    let maxDist = 0;

    for (let m = 12; m >= 0; m--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      const totalDist = parsedWorkouts
        .filter(w => w.category === sportCategory && w.dateObj >= monthStart && w.dateObj <= monthEnd)
        .reduce((acc, w) => acc + w.distanceMiles, 0);

      const roundedDist = Math.floor(totalDist);
      if (roundedDist > maxDist) maxDist = roundedDist;

      monthlyTotals.push({
        month: formatMMMYYYY(targetMonth),
        rawDistance: roundedDist,
        distanceStr: `${roundedDist} mi`
      });
    }

    return { monthlyTotals, maxDist };
  };

  const { monthlyTotals: monthlyRunTotals, maxDist: maxRunDist } = buildMonthlyTotals('Run');
  const { monthlyTotals: monthlyBikeTotals, maxDist: maxBikeDist } = buildMonthlyTotals('Bike');

  // 6. POP AND SUGAR GRID DATA
  const totalDaysPop = 61 * 7;
  const popSugarDays = [];
  
  // Index wellness entries by normalized YYYY-MM-DD
  const wellnessMap = new Map();
  wellness.forEach((item) => {
    const dStr = item.date || item.id || item.day;
    if (dStr) {
      const norm = dStr.split('T')[0];
      wellnessMap.set(norm, item);
    }
  });

  const startDatePop = addDays(currentMon, -(60 * 7));
  for (let i = 0; i < totalDaysPop; i++) {
    const curDate = addDays(startDatePop, i);
    const yyyy = curDate.getFullYear();
    const mm = String(curDate.getMonth() + 1).padStart(2, '0');
    const dd = String(curDate.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;

    const entry = wellnessMap.get(key);
    const popValue = entry ? (entry.popandsugar ?? entry.popAndSugar ?? 0) : 0;

    popSugarDays.push({
      dateStr: key,
      value: Number(popValue)
    });
  }

  // Render Helpers
  const renderWeekGrid = (gridData, title) => (
    <div className="weekly-grid-card">
      <div className="weekly-grid-header">
        {title}: {gridData.range} ({gridData.totalActivities} activities)
      </div>
      
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

      <div className="weekly-grid-items-row">
        {gridData.days.map((d, idx) => (
          <div key={idx} className="weekly-day-column">
            {d.items.length === 0 ? (
              <span className="empty-day-dash">—</span>
            ) : (
              d.items.map((item, iIdx) => {
                const isTriSport = !!item.category;
                return (
                  <div key={iIdx} className="activity-item">
                    {isTriSport ? `${item.displayLabel} ${item.distance || ''}` : item.displayLabel}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderBarChart = (title, dataList, maxVal) => (
    <div className="monthly-card">
      <h3 className="section-subtitle">{title}</h3>
      <div className="monthly-barchart-container">
        {dataList.map((item, mIdx) => {
          const heightPercent = maxVal > 0 ? (item.rawDistance / maxVal) * 100 : 0;
          return (
            <div key={mIdx} className="monthly-bar-column">
              <div className="monthly-bar-val">{item.distanceStr}</div>
              <div className="monthly-bar-track">
                <div 
                  className="monthly-bar-fill" 
                  style={{ height: `${heightPercent}%` }}
                  title={`${item.month}: ${item.distanceStr}`}
                />
              </div>
              <div className="monthly-bar-label">{item.month}</div>
            </div>
          );
        })}
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
                  <th className="col-year"><span>Year</span></th>
                  <th className="col-act"><span>Act</span></th>
                  <th className="col-total"><span>Total</span></th>
                </tr>
              </thead>
              <tbody>
                {b.annualTable.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="col-year"><span>{row.year}</span></td>
                    <td className="col-act"><span>{row.activitiesCount}</span></td>
                    <td className="col-total"><span>{row.total}</span></td>
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
                <React.Fragment key={wIdx}>
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
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 4: MONTHLY RUN TOTALS */}
      {renderBarChart("MONTHLY RUN TOTALS", monthlyRunTotals, maxRunDist)}

      {/* SECTION 5: MONTHLY BIKE TOTALS */}
      {renderBarChart("MONTHLY BIKE TOTALS", monthlyBikeTotals, maxBikeDist)}

      {/* SECTION 6: POP AND SUGAR GRID */}
      <div className="popsugar-card">
        <h3 className="section-subtitle-center">
          POP AND SUGAR
        </h3>

        <div className="popsugar-grid-container">
          {popSugarDays.map((day, idx) => {
            const countClass = day.value !== 0 ? 'count-1' : 'count-0';
            return (
              <div
                key={idx}
                title={`${day.dateStr}: ${day.value}`}
                className={`popsugar-cell ${countClass}`}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
}