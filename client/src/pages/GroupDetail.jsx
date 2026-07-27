import { useState, useEffect } from 'react';
import { apiRequest } from '../api/api';

function GroupDetail({ groupId, groupName, token, onBack }) {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [settlements, setSettlements] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  function nameFor(userId) {
    const member = members.find(m => m.userId === parseInt(userId));
    return member ? member.name : `User ${userId}`;
  }

  async function loadData() {
    try {
      const memberData = await apiRequest(`/api/groups/${groupId}/members`, 'GET', null, token);
      setMembers(memberData);

      const expenseData = await apiRequest(`/api/groups/${groupId}/expenses`, 'GET', null, token);
      setExpenses(expenseData);

      const balanceData = await apiRequest(`/api/groups/${groupId}/balances`, 'GET', null, token);
      setBalances(balanceData);

      const settleData = await apiRequest(`/api/groups/${groupId}/settle`, 'GET', null, token);
      setSettlements(settleData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, [groupId]);

  async function handleAddExpense(e) {
    e.preventDefault();
    setError('');

    try {
      await apiRequest(
        `/api/groups/${groupId}/expenses`,
        'POST',
        { description, amount: parseFloat(amount), category, date },
        token
      );
      setDescription('');
      setAmount('');
      setCategory('Other');
      setDate('');
      loadData();
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
        Back to Groups
      </button>
      <h1>{groupName || 'Group Details'}</h1>
      <p className="subtitle">Track expenses and settle up with the group.</p>

      <div className="section card">
        <h2>Add an Expense</h2>
        <form onSubmit={handleAddExpense}>
          <div className="field">
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-row field">
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Groceries">Groceries</option>
              <option value="Rent">Rent</option>
              <option value="Utilities">Utilities</option>
              <option value="Trip">Trip</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="field">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary full-width">Add Expense</button>
        </form>
      </div>

      <div className="section card">
        <h2>Expense History</h2>
        {expenses.length === 0 ? (
          <div className="empty-state">No expenses logged yet.</div>
        ) : (
          expenses.map((exp) => (
            <div className="row" key={exp.id}>
              <span className="row-label">
                <strong>{exp.description}</strong>
                <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>
                  {exp.category} · paid by {exp.paidByName} · {new Date(exp.date).toLocaleDateString()}
                </span>
              </span>
              <span className="badge">${exp.amount.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>

      <div className="section card">
        <h2>Balances</h2>
        {Object.keys(balances).length === 0 ? (
          <div className="empty-state">Nobody owes anything yet.</div>
        ) : (
          Object.entries(balances).map(([userId, amount]) => (
            <div className="row" key={userId}>
              <span className="row-label">
                <span className="avatar" style={{ width: 30, height: 30, borderRadius: 8, fontSize: 13 }}>
                  {nameFor(userId).charAt(0).toUpperCase()}
                </span>
                {nameFor(userId)}
              </span>
              <span className={`pill ${amount >= 0 ? 'pill-owed' : 'pill-owes'}`}>
                {amount >= 0 ? `is owed $${amount.toFixed(2)}` : `owes $${Math.abs(amount).toFixed(2)}`}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="section card">
        <h2>Suggested Settlements</h2>
        {settlements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto' }}>
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            Everyone's settled up!
          </div>
        ) : (
          settlements.map((s, i) => (
            <div className="row" key={i}>
              <span className="row-label">
                {nameFor(s.from)}
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--ink-faint)' }}>
                  <path d="M4 10h11m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {nameFor(s.to)}
              </span>
              <span className="badge">${s.amount.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default GroupDetail;
