function PreAuthNav({ view, onNavigate }) {
  return (
    <div className="pre-auth-nav">
      <button
        type="button"
        className="pre-auth-brand"
        onClick={() => onNavigate('landing')}
      >
        EvenUp
      </button>
      <div className="pre-auth-nav-links">
        <button
          type="button"
          className={`pre-auth-nav-link${view === 'landing' ? ' active' : ''}`}
          onClick={() => onNavigate('landing')}
        >
          Main
        </button>
        <button
          type="button"
          className={`pre-auth-nav-link${view === 'login' ? ' active' : ''}`}
          onClick={() => onNavigate('login')}
        >
          Sign Up/Log In
        </button>
      </div>
    </div>
  );
}

export default PreAuthNav;
