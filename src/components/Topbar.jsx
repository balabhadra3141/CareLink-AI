import { useAuth } from '../context/AuthContext';
import { LogOut, Globe2 } from 'lucide-react';

export default function Topbar() {
  const { currentUser, userRole, logout } = useAuth();

  return (
    <header className="header">
      <div className="brand">
        <Globe2 className="brand-icon" size={28} />
        <span>CareLink AI</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
            {currentUser?.email}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
            {userRole} Account
          </div>
        </div>
        <button 
          onClick={logout}
          className="btn btn-secondary"
          style={{ padding: '0.5rem', borderRadius: '50%' }}
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
