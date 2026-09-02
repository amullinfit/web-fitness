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
 * Checks if item is a shoe based on type/category/name attributes.
 */
const isShoeGear = (gear) => {
  const name = (gear.name || '').toLowerCase();
  const type = (gear.type || gear.category || '').toLowerCase();

  if (type.includes('shoe') || type.includes('footwear') || type.includes('run')) return true;
  if (name.includes('shoe') || name.includes('runner') || name.includes('vaporfly') || name.includes('clifton')) return true;

  return !type.includes('bike') && !type.includes('component') && !type.includes('apparel');
};

/**
 * Checks if item represents unassigned activities ("NOT ASSIGNED TO A SHOE")
 */
const isUnassignedActivity = (gear) => {
  const name = (gear.name || '').toUpperCase();
  const type = (gear.type || gear.category || '').toUpperCase();
  return name.includes('NOT ASSIGNED TO A SHOE') || type.includes('NOT ASSIGNED TO A SHOE');
};

/**
 * Checks whether retired contains a valid date value or string
 */
const hasRetiredDate = (gear) => {
  if (!gear.retired || gear.retired === false) return false;
  return true;
};

/**
 * Helper to format date strings cleanly
 */
const formatRetiredDate = (dateVal) => {
  if (typeof dateVal === 'boolean') return 'Retired';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function GearView({ gearList: initialGearList }) {
  const [gearData, setGearData] = useState(initialGearList || []);
  const [loading, setLoading] = useState(!initialGearList || initialGearList.length === 0);

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

  const activeShoes = [];
  const retiredShoes = [];
  const unassignedActivities = [];
  const otherGear = [];

  gearData.forEach((item) => {
    const isUnassigned = isUnassignedActivity(item);
    const isShoe = isShoeGear(item);
    const isRetired = hasRetiredDate(item);

    if (isUnassigned) {
      unassignedActivities.push(item);
    } else if (isShoe) {
      if (isRetired) {
        retiredShoes.push(item);
      } else {
        activeShoes.push(item);
      }
    } else {
      otherGear.push(item);
    }
  });

  const renderGearCard = (item, isShoe = true) => {
    const distanceMiles = getDistanceInMiles(item);
    const maxMiles = item.max_distance_miles || DEFAULT_MAX_SHOE_MILES;
    const rawProgress = (distanceMiles / maxMiles) * 100;
    const progressPercent = Math.min(100, rawProgress);
    const isRetired = hasRetiredDate(item);

    // Dynamic color class calculation
    let progressColorClass = '';
    if (rawProgress > 90) {
      progressColorClass = 'progress-danger'; // Red (>90%)
    } else if (rawProgress > 75) {
      progressColorClass = 'progress-warning'; // Yellow (>75%)
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
              <span>{maxMiles} miles</span>
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
        <h3 className="gear-section-title">Active Shoes</h3>
        {activeShoes.length === 0 ? (
          <p className="no-gear-msg">No active shoes found.</p>
        ) : (
          <div className="gear-grid">
            {activeShoes.map((shoe) => renderGearCard(shoe, true))}
          </div>
        )}
      </section>

      {/* 2. Unassigned Activities Section */}
      <section className="gear-section">
        <h3 className="gear-section-title">Unassigned Activities</h3>
        {unassignedActivities.length === 0 ? (
          <p className="no-gear-msg">No unassigned activities found.</p>
        ) : (
          <div className="gear-grid">
            {unassignedActivities.map((item) => renderGearCard(item, false))}
          </div>
        )}
      </section>

      {/* 3. Retired Shoes Section */}
      <section className="gear-section">
        <h3 className="gear-section-title">Retired Shoes</h3>
        {retiredShoes.length === 0 ? (
          <p className="no-gear-msg">No retired shoes.</p>
        ) : (
          <div className="gear-grid">
            {retiredShoes.map((shoe) => renderGearCard(shoe, true))}
          </div>
        )}
      </section>

      {/* 4. Other Equipment Section */}
      <section className="gear-section">
        <h3 className="gear-section-title">Other Equipment</h3>
        {otherGear.length === 0 ? (
          <p className="no-gear-msg">No other equipment listed.</p>
        ) : (
          <div className="gear-grid">
            {otherGear.map((item) => renderGearCard(item, false))}
          </div>
        )}
      </section>
    </div>
  );
}