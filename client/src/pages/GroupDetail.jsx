import { useState, useEffect } from 'react';
import { apiRequest } from '../api/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

function GroupDetail({ groupId, groupName, token, onBack, onViewDrinks }) {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [settlements, setSettlements] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('paid');
  const [error, setError] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

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

      const categoryChartData = await apiRequest(`/api/groups/${groupId}/spending-by-category`, 'GET', null, token);
      setCategoryData(categoryChartData);
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
        { description, amount: parseFloat(amount), category, date, status },
        token
      );
      setDescription('');
      setAmount('');
      setCategory('Other');
      setDate('');
      setStatus('paid');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkPaid(expenseId) {
    setError('');
    try {
      await apiRequest(`/api/expenses/${expenseId}/pay`, 'PATCH', null, token);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteExpense(expenseId) {
    setError('');
    try {
      await apiRequest(`/api/expenses/${expenseId}`, 'DELETE', null, token);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleParseExpense() {
    if (!aiText.trim()) return;
    setError('');
    setAiLoading(true);
    try {
      const parsed = await apiRequest(`/api/groups/${groupId}/parse-expense`, 'POST', { text: aiText }, token);
      setDescription(parsed.description);
      setAmount(parsed.amount.toString());
      setCategory(parsed.category);
      setDate(parsed.date);
      setAiText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  const pendingExpenses = expenses.filter(e => e.status === 'pending');
  const paidExpenses = expenses.filter(e => e.status !== 'pending');

  return (
    <div className="page">
      <button className="back-link" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15.5 7 10l5.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Groups
      </button>
      <div className="top-bar">
        <h1>{groupName || 'Group Details'}</h1>
        <button className="secondary" onClick={onViewDrinks}>Drink Log</button>
      </div>
      <p className="subtitle">Track expenses and settle up with the group.</p>

      <div className="section card">
        <h2>Add an Expense</h2>
        <div className="field" style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder='Try: "I spent 40 on pizza last night"'
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          <button type="button" className="secondary" onClick={handleParseExpense} disabled={aiLoading}>
            {aiLoading ? '...' : '✨ Fill with AI'}
          </button>
        </div>
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
          <div className="form-row field">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="paid">Already paid</option>
              <option value="pending">Pending (not paid yet)</option>
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary full-width">Add Expense</button>
        </form>
      </div>

      <div className="section card">
        <h2>Upcoming Bills</h2>
        {pendingExpenses.length === 0 ? (
          <div className="empty-state">No pending bills right now.</div>
        ) : (
          pendingExpenses.map((exp) => (
            <div className="row" key={exp.id}>
              <span className="row-label">
                <strong>{exp.description}</strong>
                <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>
                  {exp.category} · {new Date(exp.date).toLocaleDateString()}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge">${exp.amount.toFixed(2)}</span>
                <button className="secondary" onClick={() => handleMarkPaid(exp.id)}>
                  Mark as Paid
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="section card">
        <h2>Expense History</h2>
        {paidExpenses.length === 0 ? (
          <div className="empty-state">No expenses logged yet.</div>
        ) : (
          paidExpenses.map((exp) => (
            <div className="row" key={exp.id}>
              <span className="row-label">
                <strong>{exp.description}</strong>
                <span style={{ color: 'var(--ink-faint)', marginLeft: 8 }}>
                  {exp.category} · paid by {exp.paidByName} · {new Date(exp.date).toLocaleDateString()}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge">${exp.amount.toFixed(2)}</span>
                <button className="secondary" onClick={() => handleDeleteExpense(exp.id)}>
                  Delete
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="section card">
        <h2>Balances</h2>
        {members.length === 0 ? (
          <div className="empty-state">No members in this group yet.</div>
        ) : (
          members.map((member) => {
            const bal = balances[member.userId] || 0;
            const isSettled = Math.abs(bal) < 0.01;

            return (
              <div className="row" key={member.userId}>
                <span className="row-label">
                  <span className="avatar" style={{ width: 30, height: 30, borderRadius: 8, fontSize: 13 }}>
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  {member.name}
                </span>
                <span className={`pill ${isSettled ? 'pill-settled' : bal >= 0 ? 'pill-owed' : 'pill-owes'}`}>
                  {isSettled
                    ? 'Settled up'
                    : bal >= 0
                      ? `is owed $${bal.toFixed(2)}`
                      : `owes $${Math.abs(bal).toFixed(2)}`}
                </span>
              </div>
            );
          })
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

      <div className="section card">
        <h2>Spending by Category</h2>
        {categoryData.length === 0 ? (
          <div className="empty-state">No spending data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry) => `${entry.category}: $${entry.total.toFixed(0)}`}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={index} fill={['#2563eb', '#059669', '#dc2626', '#d97706', '#0891b2'][index % 5]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default GroupDetail;
