import React, { useState, useEffect } from 'react';
import './GearView.css';

const GEAR_URL = "/api/val-gear";
const DEFAULT_MAX_SHOE_MILES = 400;

/**
 * Normalizes distance values to miles.
 */
const getDistanceInMiles = (gear) => {
  if (gear.distance_miles !== undefined) return gear.distance_miles;
  if (gear.distance_m !== undefined) return gear.distance_m / 1609.34;
  if (gear.distance !== undefined) {
    return gear.distance > 5000 ? gear.distance / 1609.34 : gear.distance;
  }
  return 0;
};

/**
 * Extracts threshold distance (in miles) from gear reminders.
 * Scans for reminder names starting with "Max Usage", "Max Dist", or "Max Distance".
 */
const getThresholdFromReminders = (gear) => {
  if (!Array.isArray(gear?.reminders)) return null;

  const targetPrefixes = ['max usage', 'max dist', 'max distance'];

  const match = gear.reminders.find((r) => {
    if (!r || !r.name) return false;
    const lowerName = r.name.toLowerCase().trim();
    return targetPrefixes.some((prefix) => lowerName.startsWith(prefix));
  });

  if (match && typeof match.distance === 'number' && match.distance > 0) {
    return match.distance > 5000 ? match.distance / 1609.34 : match.distance;
  }

  return null;
};

/**
 * Checks if item is a shoe based on type/category/name attributes.
 */
const isShoeGear = (gear) => {
  const type = (gear.type || '').toLowerCase();
  return type.includes('shoe');
};

/**
 * Checks if item represents unassigned activities ("NOT ASSIGNED A SHOE" or "NOT TRACKED")
 */
const isUnassignedActivity = (gear) => {
  const name = (gear.name || '').toUpperCase();
  return name.includes('NOT ASSIGNED A SHOE') || name.includes('NOT TRACKED');
};

/**
 * Checks whether retired contains a valid date value or string
 */
const hasRetiredDate = (gear) => Boolean(gear.retired);

/**
 * Helper to format date strings cleanly
 */
const formatRetiredDate = (dateVal) => {
  if (typeof dateVal === 'boolean') return 'Retired';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Helper to sort array of gear by distance descending
 */
const sortByDistanceDesc = (items) => {
  return [...items].sort((a, b) => getDistanceInMiles(b) - getDistanceInMiles(a));
};

export default function GearView({ gearList: initialGearList }) {
  const [gearData, setGearData] = useState(initialGearList || []);
  const [loading, setLoading] = useState(!initialGearList || initialGearList.length === 0);

  // Section collapse states (Active Shoes starts open, others collapsed)
  const [openSections, setOpenSections] = useState({
    activeShoes: true,
    unassigned: false,
    retiredShoes: false,
    otherGear: false,
  });

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  useEffect(() => {
    if (initialGearList && initialGearList.length > 0) {
      setGearData(initialGearList);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(GEAR_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        const list = Array.isArray(json) ? json : json?.gear || json?.items || [];
        setGearData(list);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching gear:", err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialGearList]);

  const rawActiveShoes = [];
  const rawRetiredShoes = [];
  const rawUnassignedActivities = [];
  const rawOtherGear = [];

  gearData.forEach((item) => {
    const isUnassigned = isUnassignedActivity(item);
    const isShoe = isShoeGear(item);
    const isRetired = hasRetiredDate(item);

    if (isUnassigned) {
      rawUnassignedActivities.push(item);
    } else if (isShoe) {
      if (isRetired) {
        rawRetiredShoes.push(item);
      } else {
        rawActiveShoes.push(item);
      }
    } else {
      rawOtherGear.push(item);
    }
  });

  // Sort each section by distance descending
  const activeShoes = sortByDistanceDesc(rawActiveShoes);
  const retiredShoes = sortByDistanceDesc(rawRetiredShoes);
  const unassignedActivities = sortByDistanceDesc(rawUnassignedActivities);
  const otherGear = sortByDistanceDesc(rawOtherGear);

  const renderGearCard = (item, isShoe = true) => {
    const distanceMiles = getDistanceInMiles(item);
    const reminderThreshold = getThresholdFromReminders(item);
    const maxMiles = reminderThreshold || item.max_distance_miles || DEFAULT_MAX_SHOE_MILES;

    const rawProgress = (distanceMiles / maxMiles) * 100;
    const progressPercent = Math.min(100, rawProgress);
    const isRetired = hasRetiredDate(item);

    let progressColorClass = '';
    if (rawProgress > 90) {
      progressColorClass = 'progress-danger';
    } else if (rawProgress > 75) {
      progressColorClass = 'progress-warning';
    }

    return (
      <div key={item.id || item.name} className={`gear-card ${isRetired ? 'retired-card' : ''}`}>
        <div className="gear-card-header">
          <h4>{item.name || 'Unnamed Gear'}</h4>
          {isRetired ? (
            <span className="badge badge-retired">
              Retired: {formatRetiredDate(item.retired)}
            </span>
          ) : (
            <span className="badge badge-active">Active</span>
          )}
        </div>

        {item.brand && <p className="gear-subtext">{item.brand} {item.model}</p>}

        <div className="gear-stats">
          <div className="gear-stat-row">
            <span>Distance:</span>
            <strong>{distanceMiles.toFixed(1)} miles</strong>
          </div>
          {isShoe && (
            <div className="gear-stat-row">
              <span>Max Threshold:</span>
              <span>{Math.round(maxMiles)} miles</span>
            </div>
          )}
        </div>

        {isShoe && (
          <div className="progress-bar-container">
            <div
              className={`progress-bar-fill ${progressColorClass}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="gear-view-loading">Loading Gear Data...</div>;

  return (
    <div className="gear-view-container">
      <h2>Gear Tracker</h2>

      {/* 1. Active Shoes Section */}
      <section className="gear-section">
        <button
          className="gear-section-title-btn"
          onClick={() => toggleSection('activeShoes')}
        >
          <span>Active Shoes ({activeShoes.length})</span>
          <span className="toggle-icon">{openSections.activeShoes ? '▲' : '▼'}</span>
        </button>

        {openSections.activeShoes && (
          activeShoes.length === 0 ? (
            <p className="no-gear-msg">No active shoes found.</p>
          ) : (
            <div className="gear-grid">
              {activeShoes.map((shoe) => renderGearCard(shoe, true))}
            </div>
          )
        )}
      </section>

      {/* 2. Unassigned Activities Section */}
      <section className="gear-section">
        <button
          className="gear-section-title-btn"
          onClick={() => toggleSection('unassigned')}
        >
          <span>Unassigned Activities ({unassignedActivities.length})</span>
          <span className="toggle-icon">{openSections.unassigned ? '▲' : '▼'}</span>
        </button>

        {openSections.unassigned && (
          unassignedActivities.length === 0 ? (
            <p className="no-gear-msg">No unassigned activities found.</p>
          ) : (
            <div className="gear-grid">
              {unassignedActivities.map((item) => renderGearCard(item, false))}
            </div>
          )
        )}
      </section>

      {/* 3. Retired Shoes Section */}
      <section className="gear-section">
        <button
          className="gear-section-title-btn"
          onClick={() => toggleSection('retiredShoes')}
        >
          <span>Retired Shoes ({retiredShoes.length})</span>
          <span className="toggle-icon">{openSections.retiredShoes ? '▲' : '▼'}</span>
        </button>

        {openSections.retiredShoes && (
          retiredShoes.length === 0 ? (
            <p className="no-gear-msg">No retired shoes.</p>
          ) : (
            <div className="gear-grid">
              {retiredShoes.map((shoe) => renderGearCard(shoe, true))}
            </div>
          )
        )}
      </section>

      {/* 4. Other Equipment Section */}
      <section className="gear-section">
        <button
          className="gear-section-title-btn"
          onClick={() => toggleSection('otherGear')}
        >
          <span>Other Equipment ({otherGear.length})</span>
          <span className="toggle-icon">{openSections.otherGear ? '▲' : '▼'}</span>
        </button>

        {openSections.otherGear && (
          otherGear.length === 0 ? (
            <p className="no-gear-msg">No other equipment listed.</p>
          ) : (
            <div className="gear-grid">
              {otherGear.map((item) => renderGearCard(item, false))}
            </div>
          )
        )}
      </section>
    </div>
  );
}