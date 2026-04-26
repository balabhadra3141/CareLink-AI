import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, MapPin, Clock, BrainCircuit, Users, Check, X, Loader2, Trophy, CheckCircle2, Globe, Settings, Save, ShieldAlert } from 'lucide-react';

export default function AdminDashboard() {
  const { currentUser, userProfile, updateUserEmail, updateUserPassword } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'volunteers' | 'leaderboard' | 'global_feed' | 'settings'
  const [resolvingId, setResolvingId] = useState(null);
  
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [volunteers, setVolunteers] = useState([]);
  const [loadingVolunteers, setLoadingVolunteers] = useState(true);

  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  const [globalFeed, setGlobalFeed] = useState([]);
  const [loadingGlobalFeed, setLoadingGlobalFeed] = useState(true);

  // Settings State - Profile
  const [updateName, setUpdateName] = useState('');
  const [updateMobile, setUpdateMobile] = useState('');
  const [updateLocation, setUpdateLocation] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Settings State - Security
  const [secPassword, setSecPassword] = useState('');
  const [secNewEmail, setSecNewEmail] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secUpdating, setSecUpdating] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setUpdateName(userProfile.name || '');
      setUpdateMobile(userProfile.mobileNumber || '');
      setUpdateLocation(userProfile.coverageLocality || userProfile.location || '');
      setSecNewEmail(userProfile.email || '');
    }
  }, [userProfile]);

  // Fetch Assigned Reports
  useEffect(() => {
    async function fetchAssignedReports() {
      if (!currentUser) return;
      setLoadingReports(true);
      try {
        const q = query(
          collection(db, 'reports'),
          where('aiAnalysis.assignedNgosIds', 'array-contains', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetchedReports = [];
        querySnapshot.forEach((doc) => {
          fetchedReports.push({ id: doc.id, ...doc.data() });
        });
        fetchedReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setReports(fetchedReports);
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
      setLoadingReports(false);
    }

    if (activeTab === 'tasks') fetchAssignedReports();
  }, [currentUser, activeTab]);

  // Fetch Volunteers
  useEffect(() => {
    async function fetchVolunteers() {
      if (!currentUser) return;
      setLoadingVolunteers(true);
      try {
        const qApproved = query(collection(db, 'users'), where('approvedNgos', 'array-contains', currentUser.uid));
        const qPending = query(collection(db, 'users'), where('pendingNgos', 'array-contains', currentUser.uid));
        
        const [snap1, snap2] = await Promise.all([getDocs(qApproved), getDocs(qPending)]);
        const volsMap = new Map();
        
        snap1.forEach(doc => volsMap.set(doc.id, { id: doc.id, ...doc.data() }));
        snap2.forEach(doc => volsMap.set(doc.id, { id: doc.id, ...doc.data() }));

        setVolunteers(Array.from(volsMap.values()));
      } catch (err) {
        console.error("Error fetching volunteers:", err);
      }
      setLoadingVolunteers(false);
    }
    
    if (activeTab === 'volunteers') fetchVolunteers();
  }, [currentUser, activeTab]);

  // Fetch Leaderboard
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoadingLeaderboard(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'));
        const querySnapshot = await getDocs(q);
        const ngos = [];
        querySnapshot.forEach((doc) => {
          ngos.push({ id: doc.id, ...doc.data() });
        });
        // Sort by resolvedCount descending
        ngos.sort((a, b) => (b.resolvedCount || 0) - (a.resolvedCount || 0));
        setLeaderboard(ngos);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      }
      setLoadingLeaderboard(false);
    }

    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab]);

  // Fetch Global Feed
  useEffect(() => {
    async function fetchGlobalFeed() {
      setLoadingGlobalFeed(true);
      try {
        const q = query(collection(db, 'reports'));
        const querySnapshot = await getDocs(q);
        const feed = [];
        querySnapshot.forEach((doc) => {
          feed.push({ id: doc.id, ...doc.data() });
        });
        feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setGlobalFeed(feed);
      } catch (err) {
        console.error("Error fetching global feed:", err);
      }
      setLoadingGlobalFeed(false);
    }

    if (activeTab === 'global_feed') fetchGlobalFeed();
  }, [activeTab]);

  const handleVolunteerAction = async (volunteerId, action) => {
    try {
      const vol = volunteers.find(v => v.id === volunteerId);
      if (!vol) return;

      const userRef = doc(db, 'users', volunteerId);
      if (action === 'accept') {
        const newPending = (vol.pendingNgos || []).filter(id => id !== currentUser.uid);
        const newApproved = [...(vol.approvedNgos || []), currentUser.uid];
        await updateDoc(userRef, { pendingNgos: newPending, approvedNgos: newApproved });
        await updateDoc(doc(db, 'users', currentUser.uid), { volunteerCount: increment(1) });
        setVolunteers(prev => prev.map(v => v.id === volunteerId ? { ...v, pendingNgos: newPending, approvedNgos: newApproved } : v));
      } else if (action === 'reject') {
        const newPending = (vol.pendingNgos || []).filter(id => id !== currentUser.uid);
        await updateDoc(userRef, { pendingNgos: newPending });
        setVolunteers(prev => prev.map(v => v.id === volunteerId ? { ...v, pendingNgos: newPending } : v).filter(v => v.pendingNgos.length > 0 || v.approvedNgos.includes(currentUser.uid)));
      }
    } catch (err) {
      console.error("Failed to update volunteer:", err);
      alert("Failed to update volunteer status.");
    }
  };

  const handleMarkResolved = async (reportId) => {
    if (resolvingId) return; // Prevent multi-click spam
    setResolvingId(reportId);
    try {
      const rRef = doc(db, 'reports', reportId);
      const rSnap = await getDoc(rRef);
      if (rSnap.data().status === 'resolved') {
         setResolvingId(null);
         return; // Already resolved
      }

      await updateDoc(rRef, { status: 'resolved' });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      await updateDoc(doc(db, 'users', currentUser.uid), { resolvedCount: increment(1) });
    } catch (err) {
      console.error("Failed to mark resolved:", err);
      alert("Failed to resolve task.");
    }
    setResolvingId(null);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: updateName,
        mobileNumber: updateMobile,
        coverageLocality: updateLocation,
        location: updateLocation
      });
      alert("Profile updated successfully!");
    } catch(e) {
      console.error("Failed to update profile", e);
      alert("Failed to update profile.");
    }
    setUpdatingProfile(false);
  }

  const handleUpdateSecurity = async (e) => {
    e.preventDefault();
    if (!secPassword) return alert("Current password is required.");
    setSecUpdating(true);
    try {
      if (secNewEmail && secNewEmail !== userProfile.email) {
        await updateUserEmail(secPassword, secNewEmail);
      }
      if (secNewPassword) {
        await updateUserPassword(secPassword, secNewPassword);
      }
      alert("Security credentials updated successfully!");
      setSecPassword('');
      setSecNewPassword('');
    } catch(err) {
      console.error(err);
      alert("Failed to update credentials. Please ensure your current password is correct.");
    }
    setSecUpdating(false);
  }

  const pendingVolunteers = volunteers.filter(v => v.pendingNgos?.includes(currentUser.uid));
  const approvedVolunteers = volunteers.filter(v => v.approvedNgos?.includes(currentUser.uid));

  return (
    <div className="container animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Resource Control Center</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage your assigned tasks and your team of volunteers.
            <br/>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>Public ID: <strong>{userProfile?.publicId}</strong></span>
          </p>
        </div>
        {userProfile && (
           <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <CheckCircle2 color="var(--status-low)" />
             <div>
               <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tasks Resolved</div>
               <div style={{ fontWeight: '700', fontSize: '1.25rem' }}>{userProfile.resolvedCount || 0}</div>
             </div>
           </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--card-border)', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'tasks' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'tasks' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('tasks')}
        >
          <AlertTriangle size={18} /> Assigned Tasks
        </button>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'volunteers' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'volunteers' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('volunteers')}
        >
          <Users size={18} /> My Volunteers
          {pendingVolunteers.length > 0 && (
            <span style={{ background: 'var(--status-critical)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
              {pendingVolunteers.length}
            </span>
          )}
        </button>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'leaderboard' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'leaderboard' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('leaderboard')}
        >
          <Trophy size={18} /> NGO Rankings
        </button>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'global_feed' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'global_feed' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('global_feed')}
        >
          <Globe size={18} /> Public Feed
        </button>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'settings' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'settings' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} /> Settings
        </button>
      </div>

      {/* TAB CONTENT: TASKS */}
      {activeTab === 'tasks' && (
        <>
          {loadingReports ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>
          ) : reports.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', marginBottom: '1rem' }}>
                <AlertTriangle size={32} />
              </div>
              <h3>No assigned tasks</h3>
              <p>Your team currently has no assignments.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
              {reports.map((report) => (
                <div key={report.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', opacity: report.status === 'resolved' ? 0.6 : 1 }}>
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
                    background: report.status === 'resolved' ? 'var(--status-low)' :
                                report.aiAnalysis?.severity === 'Critical' ? 'var(--status-critical)' : 
                                report.aiAnalysis?.severity === 'Medium' ? 'var(--status-medium)' : 'var(--status-low)'
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <span className={`badge ${
                      report.status === 'resolved' ? 'badge-low' :
                      report.aiAnalysis?.severity === 'Critical' ? 'badge-critical' : 
                      report.aiAnalysis?.severity === 'Medium' ? 'badge-medium' : 'badge-low'
                    }`}>
                      {report.status === 'resolved' ? 'RESOLVED' : `${report.aiAnalysis?.severity || 'Unknown'} Priority`}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={14} /> 
                      {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p style={{ fontSize: '1.1rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                    "{report.description}"
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    <MapPin size={16} color="var(--primary-color)" />
                    {report.location}
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--card-border)', marginBottom: report.status !== 'resolved' ? '1rem' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <BrainCircuit size={16} /> AI Allocation Rationale
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {report.aiAnalysis?.evaluation || report.aiAnalysis?.rationale || 'Matched based on available skills and location.'}
                    </p>
                  </div>

                  {report.status !== 'resolved' && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: '100%', borderColor: 'var(--status-low)', color: 'var(--status-low)' }}
                      onClick={() => handleMarkResolved(report.id)}
                      disabled={resolvingId === report.id}
                    >
                      {resolvingId === report.id ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Mark as Resolved</>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT: VOLUNTEERS */}
      {activeTab === 'volunteers' && (
         <>
          {loadingVolunteers ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>
          ) : (
            <div>
              {/* Pending Requests Section */}
              {pendingVolunteers.length > 0 && (
                <div style={{ marginBottom: '3rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--status-medium)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} /> Pending Join Requests
                  </h3>
                  <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {pendingVolunteers.map(vol => (
                      <div key={vol.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{vol.name} <span style={{fontSize: '0.8rem', color: 'var(--primary-color)'}}>#{vol.publicId}</span></div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            📍 {vol.location || 'Unknown Location'} <br/>
                            📞 {vol.mobileNumber || 'N/A'} <br/>
                            ✉️ {vol.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn" 
                            style={{ padding: '0.5rem', background: 'var(--status-low-bg)', color: 'var(--status-low)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                            onClick={() => handleVolunteerAction(vol.id, 'accept')}
                            title="Accept Request"
                          >
                            <Check size={18} />
                          </button>
                          <button 
                            className="btn" 
                            style={{ padding: '0.5rem', background: 'var(--status-critical-bg)', color: 'var(--status-critical)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            onClick={() => handleVolunteerAction(vol.id, 'reject')}
                            title="Reject Request"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Volunteers Section */}
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} /> Active Team Members
                </h3>
                {approvedVolunteers.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    You don't have any approved volunteers yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {approvedVolunteers.map(vol => (
                      <div key={vol.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                        <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{vol.name} <span style={{fontSize: '0.8rem', color: 'var(--primary-color)'}}>#{vol.publicId}</span></div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          📍 {vol.location || 'Unknown Location'} <br/>
                          📞 {vol.mobileNumber || 'N/A'} <br/>
                          ✉️ {vol.email}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <>
          {loadingLeaderboard ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>
          ) : (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                  <Trophy size={32} color="var(--status-medium)" />
                  <h3 style={{ fontSize: '1.5rem', margin: 0 }}>NGO Impact Rankings</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {leaderboard.map((ngo, index) => (
                    <div key={ngo.id} style={{ 
                      display: 'flex', alignItems: 'center', padding: '1.5rem', 
                      background: index === 0 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: index === 0 ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid var(--card-border)',
                      borderRadius: '8px',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: index === 0 ? 'var(--status-medium)' : 'var(--text-secondary)', width: '50px', textAlign: 'center' }}>
                        #{index + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '0.25rem' }}>{ngo.ngoName} <span style={{fontSize: '0.8rem', color: 'var(--primary-color)'}}>#{ngo.publicId}</span></div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {ngo.coverageLocality || 'Any Locality'} • Admin: {ngo.name}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                            {ngo.volunteerCount || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Volunteers
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--status-critical)' }}>
                            {ngo.assignedTasksCount || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Tasks Assigned
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--status-low)' }}>
                            {ngo.resolvedCount || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Tasks Resolved
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT: GLOBAL FEED */}
      {activeTab === 'global_feed' && (
        <>
          {loadingGlobalFeed ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>
          ) : globalFeed.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No reports have been submitted yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <Globe size={24} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Public Operations Feed</h3>
              </div>
              {globalFeed.map((report) => (
                <div key={report.id} className="glass-panel" style={{ padding: '1.5rem', borderLeft: `4px solid ${report.status === 'resolved' ? 'var(--status-low)' : 'var(--status-medium)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                      "{report.description}"
                    </div>
                    <span className={`badge ${report.status === 'resolved' ? 'badge-low' : 'badge-medium'}`}>
                      {report.status === 'resolved' ? 'Resolved' : 'Active Task'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div>
                      <strong>📍 Location:</strong> {report.location} <br/>
                      <strong>🕒 Time:</strong> {new Date(report.timestamp).toLocaleString()}
                    </div>
                    <div>
                      <strong>👤 Reported By:</strong> {report.reportedByName || 'Unknown'} <br/>
                      <strong>🏢 Volunteer NGO:</strong> {report.reportedByNgoName || 'Open Volunteer'}
                    </div>
                    <div>
                      <strong>🎯 Assigned To:</strong> {report.assignedNgoName || 'Unknown NGO'} <br/>
                      <strong>⚡ Priority:</strong> {report.aiAnalysis?.severity || 'Medium'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT: SETTINGS */}
      {activeTab === 'settings' && (
        <div>
          <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
            <form className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }} onSubmit={handleUpdateProfile}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Update Profile</h3>
              
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" required value={updateName} onChange={(e) => setUpdateName(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input type="tel" className="form-input" required value={updateMobile} onChange={(e) => setUpdateMobile(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Coverage Locality</label>
                <input type="text" className="form-input" required value={updateLocation} onChange={(e) => setUpdateLocation(e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={updatingProfile}>
                {updatingProfile ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save Changes</>}
              </button>
            </form>

            <form className="glass-panel" style={{ padding: '2rem', height: 'fit-content', border: '1px solid rgba(239, 68, 68, 0.3)' }} onSubmit={handleUpdateSecurity}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--status-critical)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} /> Account Security
              </h3>
              
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input type="email" className="form-input" required value={secNewEmail} onChange={(e) => setSecNewEmail(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">New Password (leave blank to keep current)</label>
                <input type="password" className="form-input" value={secNewPassword} onChange={(e) => setSecNewPassword(e.target.value)} placeholder="••••••••" />
              </div>

              <div className="form-group" style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
                <label className="form-label">Current Password (Required for changes)</label>
                <input type="password" className="form-input" required value={secPassword} onChange={(e) => setSecPassword(e.target.value)} placeholder="••••••••" />
              </div>

              <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem', background: 'var(--status-critical-bg)', color: 'var(--status-critical)', border: '1px solid rgba(239, 68, 68, 0.3)' }} disabled={secUpdating}>
                {secUpdating ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Update Security</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
