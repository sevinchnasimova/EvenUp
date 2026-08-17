import { useState, useEffect } from 'react';
import { apiRequest } from '../api/api';
import GroupDetail from './GroupDetail';
import DrinkLog from './DrinkLog';

function Dashboard({ token, onLogout }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [viewingDrinks, setViewingDrinks] = useState(false);

  async function loadGroups() {
    try {
      const data = await apiRequest('/api/groups', 'GET', null, token);
      setGroups(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function handleCreateGroup(e) {
    e.preventDefault();
    setError('');

    try {
      await apiRequest('/api/groups', 'POST', { name: newGroupName }, token);
      setNewGroupName('');
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  }

if (selectedGroup && viewingDrinks) {
    return (
      <DrinkLog
        groupId={selectedGroup.id}
        groupName={selectedGroup.name}
        token={token}
        onBack={() => setViewingDrinks(false)}
      />
    );
  }

  if (selectedGroup) {
    return (
      <GroupDetail
        groupId={selectedGroup.id}
        groupName={selectedGroup.name}
        token={token}
        onBack={() => setSelectedGroup(null)}
        onViewDrinks={() => setViewingDrinks(true)}
      />
    );
  }

  return (
    <div className="page">
      <div className="top-bar">
        <div className="brand">
          EvenUp
        </div>
        <button className="secondary" onClick={onLogout}>Log Out</button>
      </div>

      <h1>Your Groups</h1>
      <p className="subtitle">Create a group to start splitting expenses.</p>

      <form className="inline-form" onSubmit={handleCreateGroup}>
        <input
          type="text"
          placeholder="New group name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          required
        />
        <button type="submit" className="primary">Create</button>
      </form>

      {error && <p className="error">{error}</p>}

      {groups.length === 0 ? (
        <div className="card empty-state">
          <p>No groups yet. Create one above to get started.</p>
        </div>
      ) : (
        <div className="group-grid">
          {groups.map((group) => (
            <div
              key={group.id}
              className="group-card"
              onClick={() => setSelectedGroup(group)}
            >
              <div className="group-card-left">
                <span className="avatar">{group.name.charAt(0).toUpperCase()}</span>
                <span className="group-card-name">{group.name}</span>
              </div>
              <svg className="chevron" width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
