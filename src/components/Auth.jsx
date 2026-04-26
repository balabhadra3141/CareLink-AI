import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, User, HeartHandshake, Building2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [location, setLocation] = useState('');
  const [role, setRole] = useState('volunteer'); // 'volunteer' or 'admin'
  const [ngoName, setNgoName] = useState('');
  const [coverageLocality, setCoverageLocality] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [customInterest, setCustomInterest] = useState('');
  const [availableNgos, setAvailableNgos] = useState([]);
  const [selectedNgoId, setSelectedNgoId] = useState('open');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const availableInterests = [
    "Medical Assistance", "Food & Water", "Search & Rescue", "Shelter", "Animal Rescue", "General Relief", "Other"
  ];

  const { login, signup } = useAuth();

  useEffect(() => {
    async function fetchNgos() {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'));
        const querySnapshot = await getDocs(q);
        const ngos = [];
        querySnapshot.forEach((doc) => {
          ngos.push({ id: doc.id, ...doc.data() });
        });
        setAvailableNgos(ngos);
      } catch (err) {
        console.error("Failed to fetch NGOs. Ensure Firestore is configured.", err);
      }
    }
    fetchNgos();
  }, []);

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        let finalInterests = [...selectedInterests];
        if (finalInterests.includes('Other') && customInterest.trim() !== '') {
          finalInterests = finalInterests.filter(i => i !== 'Other');
          finalInterests.push(customInterest.trim());
        }

        const pendingNgos = selectedNgoId === 'open' ? [] : [selectedNgoId];

        await signup(
          email, 
          password, 
          role, 
          name, 
          mobileNumber,
          location,
          ngoName, 
          role === 'admin' ? finalInterests : [], 
          role === 'admin' ? coverageLocality : "",
          pendingNgos
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    }
    setLoading(false);
  };

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
            {isLogin ? <Shield className="brand-icon" size={32} /> : <User className="brand-icon" size={32} />}
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {isLogin ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? 'Log in to access your dashboard' : 'Join as a volunteer or NGO admin'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--status-critical-bg)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">I want to join as a:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className={`btn ${role === 'volunteer' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setRole('volunteer')}
                >
                  <HeartHandshake size={18} /> Volunteer
                </button>
                <button
                  type="button"
                  className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setRole('admin')}
                >
                  <Building2 size={18} /> NGO Admin
                </button>
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-input"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="+1 234 567 890"
              />
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Your Location</label>
              <input
                type="text"
                className="form-input"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="E.g., North District, Sector 4"
              />
            </div>
          )}

          {!isLogin && role === 'volunteer' && (
            <div className="form-group">
              <label className="form-label">Select Organization to Join</label>
              <select 
                className="form-input form-select"
                value={selectedNgoId}
                onChange={(e) => setSelectedNgoId(e.target.value)}
              >
                <option value="open">Register as Open Volunteer</option>
                {availableNgos.map(ngo => (
                  <option key={ngo.id} value={ngo.id}>{ngo.ngoName}</option>
                ))}
              </select>
            </div>
          )}

          {!isLogin && role === 'admin' && (
            <>
              <div className="form-group">
                <label className="form-label">NGO Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={ngoName}
                  onChange={(e) => setNgoName(e.target.value)}
                  placeholder="Hope Foundation"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Coverage Locality</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={coverageLocality}
                  onChange={(e) => setCoverageLocality(e.target.value)}
                  placeholder="E.g., North District, Sector 4, Citywide"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Areas of Focus (Select multiple)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {availableInterests.map(interest => (
                    <label 
                      key={interest} 
                      style={{ 
                        background: selectedInterests.includes(interest) ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${selectedInterests.includes(interest) ? 'var(--primary-color)' : 'var(--card-border)'}`,
                        padding: '0.4rem 0.8rem', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        style={{ display: 'none' }}
                        checked={selectedInterests.includes(interest)}
                        onChange={() => toggleInterest(interest)}
                      />
                      {interest}
                    </label>
                  ))}
                </div>
              </div>

              {selectedInterests.includes('Other') && (
                <div className="form-group">
                  <label className="form-label">Please specify your focus area</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={customInterest}
                    onChange={(e) => setCustomInterest(e.target.value)}
                    placeholder="E.g., Psychological Support"
                  />
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsLogin(!isLogin);
            }}
            style={{ fontWeight: '600' }}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </a>
        </div>
      </div>
    </div>
  );
}
