import React from 'react';

export default function Modal_AddGear({
  isOpen,
  onClose,
  loadingGear,
  activeShoesList,
  selectedGearId,
  setSelectedGearId,
  onConfirmAdd,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="gear-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="gear-modal-content"
        style={{
          backgroundColor: '#fff',
          padding: '24px',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Select Shoe to Add</h3>
        {loadingGear ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            Loading available shoes...
          </div>
        ) : activeShoesList.length === 0 ? (
          <p style={{ color: '#666' }}>No active shoes available.</p>
        ) : (
          <div
            style={{
              maxHeight: '250px',
              overflowY: 'auto',
              marginBottom: '20px',
              border: '1px solid #eee',
              borderRadius: '4px',
            }}
          >
            {activeShoesList.map((shoe) => {
              const shoeId = shoe.id || shoe.gear_id;
              const isSelected = String(selectedGearId) === String(shoeId);
              const dist = shoe.distance_miles ?? (shoe.distance_m ? shoe.distance_m / 1609.34 : 0);

              return (
                <div
                  key={shoeId}
                  onClick={() => setSelectedGearId(shoeId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#e8f5e9' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="selectShoeRadio"
                    checked={isSelected}
                    onChange={() => setSelectedGearId(shoeId)}
                    style={{ marginRight: '10px' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontWeight: '500', color: '#333' }}>{shoe.name}</span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {dist.toFixed(1)} miles
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="nav-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="nav-btn"
            style={{
              backgroundColor: '#2e7d32',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: selectedGearId ? 'pointer' : 'not-allowed',
              opacity: selectedGearId ? 1 : 0.6,
            }}
            disabled={!selectedGearId}
            onClick={onConfirmAdd}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}