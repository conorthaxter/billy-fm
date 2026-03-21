import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) navigate('/dashboard', { replace: true });
  }, [user, isLoading, navigate]);

  if (isLoading) return <div className="empty-state">Loading…</div>;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card-head">
          <div className="login-logo">billy-fm</div>
          <div className="login-sub">music library for live performers</div>
        </div>
        <div className="login-card-body">
          <div className="login-hint">track your setlists · filter by key & bpm · queue songs on the fly</div>
          <button className="login-btn" onClick={login}>
            → sign in with google
          </button>
        </div>
      </div>
    </div>
  );
}
