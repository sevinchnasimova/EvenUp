import { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PreAuthNav from './components/PreAuthNav';
import PreAuthFooter from './components/PreAuthFooter';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [view, setView] = useState('landing');

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  function handleLogin(newToken) {
    setToken(newToken);
  }

  function handleLogout() {
    setToken(null);
    setView('landing');
  }

  if (!token) {
    return (
      <div className="pre-auth-shell">
        <PreAuthNav view={view} onNavigate={setView} />
        {view === 'landing' ? (
          <Landing onGetStarted={() => setView('login')} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
        <PreAuthFooter />
      </div>
    );
  }

return <Dashboard token={token} onLogout={handleLogout} />;
}

export default App;