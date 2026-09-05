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

const formatGridDistance = (sport, distanceMiles, rawMeters) => {
  if (sport === 'Swim') {
    return formatSwimYards(rawMeters);
  }
  return `${distanceMiles.toFixed(1)} mi`;
};

const formatSportName = (rawType, isMobile) => {
  if (!rawType) return '';
  if (isMobile) {
    return rawType.replace(/virtual/i, 'V-');
  }
  return rawType;
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

const formatMmmYYParts = (d, isMobile) => {
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  let year;
  
  if (!isMobile) {
    // Desktop: always Mmm YYYY
    year = String(d.getFullYear());
  } else {
    // Mobile: always Mmm YY
    year = String(d.getFullYear()).slice(-2);
  }

  return { month, year };
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [rightBuffer, setRightBuffer] = useState(() => {
    return Number(localStorage.getItem('wf_offset')) || 0;
  });
  console.log("rightbuffer:",rightBuffer);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      const offsetVal = Number(localStorage.getItem('wf_offset')) || 0;
      setRightBuffer(offsetVal);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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

  // 1. WEEKLY BUCKETS DATA
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
          const rawLabel = isWeight ? (w.name || w.rawType) : w.rawType;
          const displayLabel = formatSportName(rawLabel, isMobile);

          return {
            category: w.category,
            displayLabel,
            distance: formatGridDistance(w.category, w.distanceMiles, w.rawMeters)
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
  const historyWeeksCount = isMobile ? 20 : 60;
  const consistencyWeeks = [];
  for (let w = historyWeeksCount; w >= 0; w--) {
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

  const dayLabelsList = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // 4 & 5. MONTHLY TOTALS
  const buildMonthlyTotals = (sportCategory) => {
    const monthlyTotals = [];
    let maxDist = 0;

    for (let m = 11; m >= 0; m--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      const totalDist = parsedWorkouts
        .filter(w => w.category === sportCategory && w.dateObj >= monthStart && w.dateObj <= monthEnd)
        .reduce((acc, w) => acc + w.distanceMiles, 0);

      const roundedDist = Math.floor(totalDist);
      if (roundedDist > maxDist) maxDist = roundedDist;

      const dateParts = formatMmmYYParts(targetMonth, isMobile);

      monthlyTotals.push({
        monthObj: dateParts,
        rawDistance: roundedDist,
        numStr: `${roundedDist}`,
        unitStr: 'mi'
      });
    }

    return { monthlyTotals, maxDist };
  };

  const { monthlyTotals: monthlyRunTotals, maxDist: maxRunDist } = buildMonthlyTotals('Run');
  const { monthlyTotals: monthlyBikeTotals, maxDist: maxBikeDist } = buildMonthlyTotals('Bike');

  // 6. POP AND SUGAR GRID DATA
  const totalDaysPop = 60;
  const wellnessMap = new Map();
  wellness.forEach((item) => {
    const dStr = item.date || item.id || item.day;
    if (dStr) {
      const norm = dStr.split('T')[0];
      wellnessMap.set(norm, item);
    }
  });

  const popSugarDaysRaw = [];
  for (let i = 0; i < totalDaysPop; i++) {
    const curDate = addDays(now, -i);
    const yyyy = curDate.getFullYear();
    const mm = String(curDate.getMonth() + 1).padStart(2, '0');
    const dd = String(curDate.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;

    const entry = wellnessMap.get(key);
    const popValue = entry ? (entry.PopAndSugar ?? entry.popandSugar ?? entry.popandsugar ?? 0) : 0;

    popSugarDaysRaw.push({
      dateStr: key,
      value: Number(popValue)
    });
  }

  const topRow = popSugarDaysRaw.slice(0, 30);
  const bottomRow = popSugarDaysRaw.slice(30, 60);

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayEntry = wellnessMap.get(todayKey);
  
  let popStreakDays = todayEntry ? (todayEntry.PopStreak ?? todayEntry.popStreak) : undefined;

  if (popStreakDays === undefined && wellness.length > 0) {
    const sortedWellness = [...wellness].sort((a, b) => {
      const dA = new Date(a.date || a.id || a.day);
      const dB = new Date(b.date || b.id || b.day);
      return dB - dA;
    });

    for (const item of sortedWellness) {
      const val = item.PopStreak ?? item.popStreak;
      if (val !== undefined && val !== null) {
        popStreakDays = val;
        break;
      }
    }
  }

  const popStreakCount = popStreakDays !== undefined && popStreakDays !== null ? Number(popStreakDays) : 0;

  // Render Helpers
  const renderWeekGrid = (gridData, title) => {
    const isBufferLargeMobile = isMobile && rightBuffer > 40;
    const displayTitle = isMobile ? title.replace(/week/gi, '').trim() : title;
    
    // Header layout determination:
    // Desktop: always inline
    // Mobile: stacked when rightBuffer > 60, otherwise inline
    const isInlineHeader = !isMobile || rightBuffer <= 60;

    console.log({ isMobile, rightBuffer, isInlineHeader });
    // Temporarily forces stacked mode
    console.log({ isMobile, rightBuffer, isInlineHeader });

    return (
      <div className={`weekly-grid-card ${isBufferLargeMobile ? 'compact-mobile-grid' : ''}`}>
        <div className={`weekly-grid-header ${isInlineHeader ? 'inline-header' : 'stacked-header'}`}>
          <span className="grid-title-text">{displayTitle}: {gridData.range}</span>
          <span className="grid-activities-count">({gridData.totalActivities} activities)</span>
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
                d.items.map((item, iIdx) => (
                  <div key={iIdx} className="activity-item">
                    <div className="activity-sport">{item.displayLabel}</div>
                    {item.distance && <div className="activity-dist">{item.distance}</div>}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBarChart = (title, dataList, maxVal) => (
    <div className="monthly-card">
      <h3 className="section-subtitle">{title}</h3>
      <div className="monthly-barchart-container">
        {dataList.map((item, mIdx) => {
          const heightPercent = maxVal > 0 ? (item.rawDistance / maxVal) * 100 : 0;
          return (
            <div key={mIdx} className="monthly-bar-column">
              <div className="monthly-bar-val">
                <span className="num-part">{item.numStr}</span>
                <span className="unit-part">{item.unitStr}</span>
              </div>
              <div className="monthly-bar-track">
                <div 
                  className="monthly-bar-fill" 
                  style={{ height: `${heightPercent}%` }}
                  title={`${item.monthObj.month} ${item.monthObj.year}: ${item.numStr} ${item.unitStr}`}
                />
              </div>
              <div className="monthly-bar-label">
                <div>{item.monthObj.month}</div>
                <div>{item.monthObj.year}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="overview-container">
      
      {/* SECTION 1: WEEKLY BUCKETS */}
      <div className="sport-buckets-container">
        {buckets.map((b, idx) => (
          <div key={idx} className="sport-bucket-card">
            <div className="sport-bucket-title">{b.type}</div>
            <div className="sport-bucket-dist">{b.currentWeekDist}</div>
            
            <div className="sport-bucket-prev">
              <span className="prev-label">Prev Week:</span>
              <span className="prev-val">
                {b.prevWeekDist}
                <RenderIndicator current={b.currentWeekVal} previous={b.prevWeekVal} />
              </span>
            </div>

            {/* Desktop Only Annual Table */}
            {!isMobile && (
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
            )}
          </div>
        ))}
      </div>

      {/* SECTION 2: WEEKLY ACTIVITY GRIDS */}
      <div className="weekly-grids-section">
        <h3 className="section-title">Weekly Activity Grids</h3>
        {renderWeekGrid(currentWeekGrid, "Current Week")}
        {renderWeekGrid(priorWeekGrid, "Prior Week")}
      </div>

      {/* SECTION 3: CONSISTENCY GRID */}
      <div className="consistency-card">
        <h3 className="section-subtitle-center">
          --- CONSISTENCY GRID ---
        </h3>

        <div className="consistency-weeks-container">
          <div className="consistency-week-column label-column">
            {dayLabelsList.map((label, lIdx) => (
              <div key={lIdx} className="consistency-cell label-cell">
                {label}
              </div>
            ))}
          </div>

          {consistencyWeeks.map((week, wIdx) => {
            const isCurrentWeek = wIdx === historyWeeksCount;
            const hasFourWeekDivider = (historyWeeksCount - wIdx) % 4 === 0 && wIdx !== historyWeeksCount;

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

          <div className="consistency-week-column label-column">
            {dayLabelsList.map((label, lIdx) => (
              <div key={lIdx} className="consistency-cell label-cell">
                {label}
              </div>
            ))}
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
          POP AND SUGAR - {popStreakCount} DAYS
        </h3>

        {isMobile ? (
          /* Mobile View: 2 Rows of 30 */
          <div className="popsugar-two-rows">
            <div className="popsugar-grid-row cols-30">
              {topRow.map((day, idx) => {
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

            <div className="popsugar-grid-row cols-30">
              {bottomRow.map((day, idx) => {
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
        ) : (
          /* Desktop View: 1 Row of 60 */
          <div className="popsugar-grid-row cols-60">
            {popSugarDaysRaw.map((day, idx) => {
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
        )}
      </div>

    </div>
  );
}