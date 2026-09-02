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
    // If distance is large, assume meters, otherwise miles
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

  // Default assumption if category is not bike/component/apparel
  return !type.includes('bike') && !type.includes('component') && !type.includes('apparel');
};

/**
 * Checks if the shoe name indicates "Not a shoe" or similar test item.
 */
const isNotAShoeNamed = (gear) => {
  const name = (gear.name || '').toLowerCase();
  return name.includes('not a shoe') || name.includes('not-a-shoe');
};

/**
 * Checks if item is marked retired.
 */
const isRetiredGear = (gear) => {
  return gear.retired === true || gear.status === 'retired' || gear.state === 'retired';
};

export default function GearView({ gearList: initialGearList }) {
  const [gearData, setGearData] = useState(initialGearList || []);
  const [loading, setLoading] = useState(!initialGearList || initialGearList.length === 0);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If initial props are provided, use them; otherwise fetch from API
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
        // Accept array directly or extracted array property
        const list = Array.isArray(json) ? json : json?.gear || json?.items || [];
        setGearData(list);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching gear:", err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialGearList]);

  const activeShoes = [];
  const retiredShoes = [];
  const notAShoeCategory = [];
  const otherGear = [];

  gearData.forEach((item) => {
    const isShoe = isShoeGear(item);
    const isNotShoeNamed = isNotAShoeNamed(item);

    if (isNotShoeNamed) {
      notAShoeCategory.push(item);
    } else if (!isShoe) {
      otherGear.push(item);
    } else if (isRetiredGear(item)) {
      retiredShoes.push(item);
    } else {
      activeShoes.push(item);
    }
  });

  const renderGearCard = (item, isShoe = true) => {
    const distanceMiles = getDistanceInMiles(item);
    const maxMiles = item.max_distance_miles || DEFAULT_MAX_SHOE_MILES;
    const progressPercent = Math.min(100, (distanceMiles / maxMiles) * 100);
    const retired = isRetiredGear(item);

    return (
      <div key={item.id || item.name} className={`gear-card ${retired ? 'retired-card' : ''}`}>
        <div className="gear-card-header">
          <h4>{item.name || 'Unnamed Gear'}</h4>
          {retired ? (
            <span className="badge badge-retired">Retired</span>
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
              className={`progress-bar-fill ${progressPercent >= 100 ? 'exceeded' : ''}`}
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
      {/* Debug Line displaying total API items retrieved */}
      <div className="gear-debug-bar">
        [DEBUG] Total Gear Items via API: <strong>{gearData.length}</strong> {error && <span style={{ color: 'red' }}>(Error: {error})</span>}
      </div>

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

      {/* 2. Retired Shoes Section */}
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

      {/* 3. Not a Shoe Section */}
      <section className="gear-section">
        <h3 className="gear-section-title">Not a Shoe</h3>
        {notAShoeCategory.length === 0 ? (
          <p className="no-gear-msg">No items in this category.</p>
        ) : (
          <div className="gear-grid">
            {notAShoeCategory.map((item) => renderGearCard(item, false))}
          </div>
        )}
      </section>

      {/* 4. Other Non-Shoe Equipment Section */}
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