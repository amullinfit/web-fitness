import React, { useState, useEffect } from 'react';

// Updated Val Town endpoint for Gear
const VAL_GEAR_URL = "/api/val-gear";

export default function GearView() {
  const [gearList, setGearList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [firstUsed, setFirstUsed] = useState('');
  const [startingDistance, setStartingDistance] = useState(0);
  const [allowedDistance, setAllowedDistance] = useState(0);
  const [imageUrl, setImageUrl] = useState('');

  const loadGear = () => {
    setLoading(true);
    fetch(VAL_GEAR_URL)
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setGearList(json);
        } else {
          setGearList([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching gear:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGear();
  }, []);

  const handleRetire = (gearId) => {
    fetch(VAL_GEAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retire', gearId })
    }).then(() => loadGear());
  };

  const handleDelete = (gearId) => {
    fetch(VAL_GEAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', gearId })
    }).then(() => loadGear());
  };

  const handleCreateGear = (e) => {
    e.preventDefault();
    const gearData = {
      name,
      created: firstUsed,
      distance: Number(startingDistance),
      distance_limit: Number(allowedDistance)
    };

    fetch(VAL_GEAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', gearData, imageUrl })
    }).then(() => {
      setShowAddForm(false);
      setName('');
      setFirstUsed('');
      setStartingDistance(0);
      setAllowedDistance(0);
      setImageUrl('');
      loadGear();
    });
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading Gear...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Gear Management</h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', width: '32px', height: '32px', fontSize: '20px', cursor: 'pointer' }}
          title="Add New Gear"
        >
          +
        </button>
      </div>

      {/* Add Gear Form Modal / Section */}
      {showAddForm && (
        <form onSubmit={handleCreateGear} style={{ border: '1px solid #28a745', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Add New Gear</h3>
          <input type="text" placeholder="Gear Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="date" placeholder="First Used" value={firstUsed} onChange={(e) => setFirstUsed(e.target.value)} required />
          <input type="number" placeholder="Starting Distance (m)" value={startingDistance} onChange={(e) => setStartingDistance(e.target.value)} />
          <input type="number" placeholder="Allowed Distance (m)" value={allowedDistance} onChange={(e) => setAllowedDistance(e.target.value)} />
          <input type="url" placeholder="Image Link (IMGBB / Hosted URL)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <button type="submit" style={{ backgroundColor: '#28a745', color: '#fff', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Gear</button>
        </form>
      )}

      {/* Gear Listing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {gearList.map((g) => {
          const usedMiles = ((g.distance || 0) * 0.000621371).toFixed(1);
          const limitMiles = ((g.distance_limit || 0) * 0.000621371).toFixed(1);
          const pct = g.distance_limit ? Math.min(100, Math.round((g.distance / g.distance_limit) * 100)) : 0;

          return (
            <div key={g.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#fff' }}>
              {g.image_url && <img src={g.image_url} alt={g.name} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '4px' }} />}
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{g.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>First Used: {g.created || 'N/A'}</div>
              
              {/* Distance Progress Bar */}
              <div>
                <div style={{ fontSize: '12px', marginBottom: '4px' }}>{usedMiles} / {limitMiles} miles ({pct}%)</div>
                <div style={{ width: '100%', backgroundColor: '#e0e0e0', height: '10px', borderRadius: '5px' }}>
                  <div style={{ width: `${pct}%`, backgroundColor: pct > 90 ? '#dc3545' : '#007bff', height: '100%', borderRadius: '5px' }} />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                {/* Updated Retire Button: White background, border, and enlarged clock icon */}
                <button 
                  onClick={() => handleRetire(g.id)}
                  style={{ 
                    width: '36px', 
                    height: '36px', 
                    backgroundColor: '#ffffff', 
                    color: '#333333', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  title="Retire Gear"
                >
                  🕒
                </button>
                <button 
                  onClick={() => handleDelete(g.id)}
                  style={{ 
                    width: '36px', 
                    height: '36px', 
                    backgroundColor: '#dc3545', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Delete Gear"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}