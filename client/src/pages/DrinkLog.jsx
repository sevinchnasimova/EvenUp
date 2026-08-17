import { useState, useEffect } from 'react';
import { apiRequest } from '../api/api';

function DrinkLog({ groupId, groupName, token, onBack }) {
  const [drinks, setDrinks] = useState([]);
  const [total, setTotal] = useState(0);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [rating, setRating] = useState(5);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  async function loadDrinks() {
    try {
      const data = await apiRequest(`/api/groups/${groupId}/drinks`, 'GET', null, token);
      setDrinks(data.drinks);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadDrinks();
  }, [groupId]);

  async function handleAddDrink(e) {
    e.preventDefault();
    setError('');

    try {
      await apiRequest(
        `/api/groups/${groupId}/drinks`,
        'POST',
        { name, cost: parseFloat(cost), rating: parseInt(rating), imageUrl: imageUrl || null },
        token
      );
      setName('');
      setCost('');
      setRating(5);
      setImageUrl('');
      loadDrinks();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <button className="back-link" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15.5 7 10l5.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to {groupName || 'Group'}
      </button>
      <h1>Drink Log</h1>
      <p className="subtitle">Track fun drinks and rate them for the group.</p>

      <div className="section card">
        <h2>Total Spent on Drinks</h2>
        <div className="row">
          <span className="row-label">All drinks logged so far</span>
          <span className="badge">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="section card">
        <h2>Log a Drink</h2>
        <form onSubmit={handleAddDrink}>
          <div className="field">
            <input
              type="text"
              placeholder="Drink name (e.g. Matcha Latte)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-row field">
            <input
              type="number"
              step="0.01"
              placeholder="Cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              required
            />
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="5">★★★★★</option>
              <option value="4">★★★★</option>
              <option value="3">★★★</option>
              <option value="2">★★</option>
              <option value="1">★</option>
            </select>
          </div>
          <div className="field">
            <input
              type="text"
              placeholder="Image URL (optional)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary full-width">Log Drink</button>
        </form>
      </div>

{drinks.some(d => d.imageUrl) && (
        <div className="section">
          <h2>Photo Gallery</h2>
          <div className="drink-gallery">
            {drinks.filter(d => d.imageUrl).map((drink) => (
              <div className="drink-gallery-item" key={drink.id}>
                <img src={drink.imageUrl} alt={drink.name} />
                <div className="drink-gallery-caption">
                  <strong>{drink.name}</strong>
                  <span>{'★'.repeat(drink.rating)}{'☆'.repeat(5 - drink.rating)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section card">
        <h2>Drink History</h2>
        {drinks.length === 0 ? (
          <div className="empty-state">No drinks logged yet.</div>
        ) : (
          drinks.map((drink) => (
            <div className="row" key={drink.id} style={{ alignItems: 'flex-start' }}>
              {drink.imageUrl && (
                <img
                  src={drink.imageUrl}
                  alt={drink.name}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', marginRight: 12 }}
                />
              )}
              <span className="row-label">
                <strong>{drink.name}</strong>
                <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>
                  {'★'.repeat(drink.rating)}{'☆'.repeat(5 - drink.rating)} · logged by {drink.loggedByName} · {new Date(drink.date).toLocaleDateString()}
                </span>
              </span>
              <span className="badge">${drink.cost.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DrinkLog;