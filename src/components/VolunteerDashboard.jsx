import { useState, useEffect } from 'react';
import { Send, MapPin, AlertCircle, Loader2, Building2, UserPlus, Clock, History, Award, CheckCircle2, Globe, Settings, LogOut, Save, ShieldAlert } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, increment } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../context/AuthContext';

// Initialize Gemini SDK with Environment Variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export default function VolunteerDashboard() {
  const { currentUser, userProfile, updateUserEmail, updateUserPassword, setUserProfile } = useAuth();
  
  const [activeTab, setActiveTab] = useState('report'); // 'report' | 'history' | 'badges' | 'global_feed' | 'settings'
  
  // Report State
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
  
  // NGO State for Settings
  const [availableNgos, setAvailableNgos] = useState([]);
  const [fetchingNgos, setFetchingNgos] = useState(true);

  // History State
  const [myHistory, setMyHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Global Feed State
  const [globalFeed, setGlobalFeed] = useState([]);
  const [loadingGlobalFeed, setLoadingGlobalFeed] = useState(true);

  useEffect(() => {
    if (userProfile) {
      setUpdateName(userProfile.name || '');
      setUpdateMobile(userProfile.mobileNumber || '');
      setUpdateLocation(userProfile.location || '');
      setSecNewEmail(userProfile.email || '');
    }
  }, [userProfile]);

  // Fetch all NGOs for Settings Management
  useEffect(() => {
    async function fetchNgos() {
      setFetchingNgos(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'));
        const querySnapshot = await getDocs(q);
        const ngos = [];
        querySnapshot.forEach((doc) => {
          ngos.push({ id: doc.id, ...doc.data() });
        });
        setAvailableNgos(ngos);
      } catch (err) {
        console.error("Failed to fetch NGOs:", err);
      }
      setFetchingNgos(false);
    }
    fetchNgos();
  }, []);

  // Fetch History and Badges
  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'badges') {
      async function fetchHistory() {
        setLoadingHistory(true);
        try {
          const q = query(collection(db, 'reports'), where('reportedBy', '==', currentUser.uid));
          const querySnapshot = await getDocs(q);
          const hist = [];
          querySnapshot.forEach((doc) => {
            hist.push({ id: doc.id, ...doc.data() });
          });
          hist.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setMyHistory(hist);
        } catch (err) {
          console.error("Failed to fetch history:", err);
        }
        setLoadingHistory(false);
      }
      fetchHistory();
    }
  }, [activeTab, currentUser]);

  // Fetch Global Feed
  useEffect(() => {
    if (activeTab === 'global_feed') {
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
      fetchGlobalFeed();
    }
  }, [activeTab]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: updateName,
        mobileNumber: updateMobile,
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

  const handleNgoAction = async (ngoId, action) => {
    try {
      setFetchingNgos(true);
      let currentPending = userProfile.pendingNgos || [];
      let currentApproved = userProfile.approvedNgos || [];

      if (action === 'join') {
        if (currentPending.length + currentApproved.length >= 3) {
          alert("You can only belong to a maximum of 3 NGOs (including pending requests).");
          setFetchingNgos(false);
          return;
        }
        if (!currentPending.includes(ngoId) && !currentApproved.includes(ngoId)) {
          currentPending.push(ngoId);
        }
      } else if (action === 'leave' || action === 'cancel') {
        currentPending = currentPending.filter(id => id !== ngoId);
        currentApproved = currentApproved.filter(id => id !== ngoId);
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        pendingNgos: currentPending,
        approvedNgos: currentApproved
      });
      
      setUserProfile(prev => ({ ...prev, pendingNgos: currentPending, approvedNgos: currentApproved }));
    } catch(e) {
      console.error(e);
      alert("Failed to update NGO membership.");
    }
    setFetchingNgos(false);
  }

  const calculateBestNgos = (ngos, reportDesc, reportLoc) => {
    // 1. Score all NGOs using forgiving `.includes()` logic
    const scored = ngos.map(ngo => {
      let score = 0;
      if (ngo.availableVolunteers > 0) score += 50; 
      
      const ngoLoc = (ngo.coverageLocality || '').toLowerCase().trim();
      const repLoc = (reportLoc || '').toLowerCase().trim();
      if (ngoLoc && repLoc && (ngoLoc.includes(repLoc) || repLoc.includes(ngoLoc))) score += 30;
      
      if (ngo.interests && ngo.interests.some(i => (reportDesc || '').toLowerCase().includes(i.toLowerCase()))) score += 20;
      
      score += Math.random(); // Add slight randomness to completely prevent flat ties
      return { ...ngo, score };
    });

    // 2. Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    
    // 3. Pick the absolute best NGO
    const topNgo = scored[0];
    if (!topNgo) return [];

    const assigned = [topNgo];

    // 4. Emergency Assignment logic: If top NGO has < 5 volunteers, pull in backups (max 2 total)
    if (topNgo.availableVolunteers < 5) {
       if (scored[1]) assigned.push(scored[1]);
    }

    return assigned;
  }

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      // 1. Fetch available NGOs from Firestore
      const usersSnap = await getDocs(collection(db, 'users'));
      let ngos = [];
      usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.role === 'admin') {
          ngos.push({ 
            id: docSnap.id, 
            name: data.ngoName, 
            interests: data.interests || [], 
            coverageLocality: data.coverageLocality || 'Any',
            availableVolunteers: data.volunteerCount || 0,
            activeAssignedTasks: data.assignedTasksCount || 0
          });
        }
      });

      if (ngos.length === 0) {
        ngos = [{ id: 'mock-1', name: 'Fallback Relief NGO', interests: [], coverageLocality: 'Any', availableVolunteers: 1 }];
      }

      // 2. JS Hybrid Engine - Deterministic Multi-NGO Selection
      const winningNgos = calculateBestNgos(ngos, description, location);
      const winningNgosData = winningNgos.map(n => ({id: n.id, name: n.name}));

      // 3. Ask Gemini to write the rationale based ONLY on the winning NGOs
      const prompt = `
        A volunteer has reported an emergency.
        Report Description: "${description}"
        Location: "${location}"

        The deterministic engine has ALREADY ASSIGNED this task to the following NGOs:
        ${winningNgos.map(n => `- ${n.name} (Volunteers Available: ${n.availableVolunteers}, Location: ${n.coverageLocality}, Focus: ${n.interests.join(', ')})`).join('\n')}

        Write a brief 1-2 sentence rationale explaining why these specific NGOs were selected. If multiple NGOs were selected, explicitly state it is due to a shortage of volunteers at the primary NGO.
        Return ONLY a JSON object with this exact structure:
        {
          "severity": "Critical or Medium or Low",
          "rationale": "Your human readable explanation here."
        }
      `;

      let aiResult;
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });
        aiResult = JSON.parse(response.text);
      } catch (aiError) {
        console.error("Gemini AI Error:", aiError);
        aiResult = { severity: "High", rationale: "Matched via deterministic location and skill engine." };
      }

      // 4. Determine Reported By NGO Name (Take the first approved NGO, or Open)
      let reportedByNgoName = "Open Volunteer";
      if (userProfile.approvedNgos && userProfile.approvedNgos.length > 0) {
        try {
          const ngoRef = await getDoc(doc(db, 'users', userProfile.approvedNgos[0]));
          if (ngoRef.exists()) {
            reportedByNgoName = ngoRef.data().ngoName;
          }
        } catch(e) {}
      }

      // 5. Save to Firestore
      await addDoc(collection(db, 'reports'), {
        description,
        location,
        timestamp: new Date().toISOString(),
        aiAnalysis: {
          severity: aiResult.severity,
          rationale: aiResult.rationale,
          assignedNgosIds: winningNgos.map(n => n.id) // Needed for easy querying by Admins
        },
        status: 'assigned',
        reportedBy: currentUser.uid,
        reportedByName: userProfile.name || 'Anonymous',
        reportedByNgoName: reportedByNgoName,
        assignedNgos: winningNgosData // Human readable names for the feed
      });

      // 6. Increment assignedTasksCount on the chosen NGOs
      for (const ngo of winningNgos) {
        if (ngo.id !== 'mock-1') {
          try { await updateDoc(doc(db, 'users', ngo.id), { assignedTasksCount: increment(1) }); } catch(e) {}
        }
      }

      setSuccess(true);
      setDescription('');
      setLocation('');
    } catch (err) {
      console.error("Error submitting report:", err);
      alert("Failed to submit report. See console.");
    }

    setLoading(false);
  };

  const handleDeleteReport = async (reportId, assignedNgosIds, status) => {
    if (!window.confirm("Are you sure you want to delete this wrongly reported issue?")) return;
    
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      
      // Decrement assigned tasks for NGOs if it was not resolved
      if (status !== 'resolved' && assignedNgosIds) {
        for (const ngoId of assignedNgosIds) {
          if (ngoId !== 'mock-1') {
            try { await updateDoc(doc(db, 'users', ngoId), { assignedTasksCount: increment(-1) }); } catch(e) {}
          }
        }
      }

      setMyHistory(prev => prev.filter(r => r.id !== reportId));
      
      // Also remove from global feed if it's currently loaded
      setGlobalFeed(prev => prev.filter(r => r.id !== reportId));
      
    } catch (err) {
      console.error(err);
      alert("Failed to delete report.");
    }
  };

  if (!userProfile) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}><Loader2 className="animate-spin" /></div>;
  }

  const totalReports = myHistory.length;
  const resolvedReports = myHistory.filter(r => r.status === 'resolved').length;
  const approvedNgos = userProfile.approvedNgos || [];
  const pendingNgos = userProfile.pendingNgos || [];
  const currentSlots = approvedNgos.length + pendingNgos.length;

  return (
    <div className="container animate-fade-in">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Volunteer Portal</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Welcome back, {userProfile.name}.
            <br/>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>Public ID: <strong>{userProfile?.publicId}</strong></span>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--card-border)', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'report' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'report' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('report')}
        >
          <AlertCircle size={18} /> Report Issue
        </button>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'history' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'history' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} /> My History
        </button>
        <button 
          className="btn"
          style={{ background: 'transparent', color: activeTab === 'badges' ? 'var(--primary-color)' : 'var(--text-secondary)', borderBottom: activeTab === 'badges' ? '2px solid var(--primary-color)' : '2px solid transparent', borderRadius: '0', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('badges')}
        >
          <Award size={18} /> My Badges
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

      {/* TAB CONTENT: REPORT ISSUE */}
      {activeTab === 'report' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Report an Issue</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Describe the situation on the ground. Our hybrid JS Engine will actively score NGOs based on location and volunteer availability to find the best match.
          </p>

          {success && (
            <div style={{ background: 'var(--status-low-bg)', color: '#86efac', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(34, 197, 94, 0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={20} />
              Report submitted successfully! The hybrid engine has routed it accurately.
            </div>
          )}

          <form className="glass-panel" style={{ padding: '2rem' }} onSubmit={handleSubmitReport}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} /> Problem Description
              </label>
              <textarea
                className="form-input"
                rows="4"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g., Severe water logging in the main street..."
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={16} /> Location
              </label>
              <input
                type="text"
                className="form-input"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Sector 4, Main Street"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? <><Loader2 className="animate-spin" size={18} /> Routing to Best NGO(s)...</> : <><Send size={18} /> Submit Report</>}
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT: MY HISTORY */}
      {activeTab === 'history' && (
        <div>
          {loadingHistory ? (
             <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" /></div>
          ) : myHistory.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              You haven't reported any issues yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myHistory.map(report => (
                <div key={report.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '1.1rem' }}>"{report.description}"</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <MapPin size={14} /> {report.location}
                      <span style={{ margin: '0 0.5rem' }}>•</span>
                      <Clock size={14} /> {new Date(report.timestamp).toLocaleDateString()}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <strong>Assigned To:</strong> {report.assignedNgos?.map(n => n.name).join(', ') || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span className={`badge ${report.status === 'resolved' ? 'badge-low' : 'badge-medium'}`} style={{ marginBottom: '0.5rem', display: 'block', textAlign: 'center' }}>
                      {report.status === 'resolved' ? 'Resolved' : 'Assigned'}
                    </span>
                    <button className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'var(--status-critical-bg)', color: 'var(--status-critical)', border: '1px solid rgba(239, 68, 68, 0.3)', width: '100%' }} onClick={() => handleDeleteReport(report.id, report.aiAnalysis?.assignedNgosIds, report.status)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MY BADGES */}
      {activeTab === 'badges' && (
        <div>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Your Impact Profile</h2>
            <div style={{ color: 'var(--text-secondary)' }}>
              Total Reports: <strong>{totalReports}</strong> | Resolved: <strong>{resolvedReports}</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {/* Badge Renderings (same as before) */}
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: totalReports >= 1 ? 1 : 0.4 }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: totalReports >= 1 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: `2px solid ${totalReports >= 1 ? 'var(--primary-color)' : 'var(--card-border)'}` }}>
                {totalReports >= 1 ? <Award size={40} color="var(--primary-color)" /> : <Award size={40} color="var(--text-secondary)" />}
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Observer</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Report your first issue to the network.</p>
              {totalReports >= 1 && <div style={{ color: 'var(--status-low)', fontSize: '0.75rem', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><CheckCircle2 size={12}/> Unlocked</div>}
            </div>

            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: totalReports >= 3 ? 1 : 0.4 }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: totalReports >= 3 ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: `2px solid ${totalReports >= 3 ? '#ec4899' : 'var(--card-border)'}` }}>
                {totalReports >= 3 ? <Award size={40} color="#ec4899" /> : <Award size={40} color="var(--text-secondary)" />}
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Active Scout</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Report 3 or more issues.</p>
              <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((totalReports / 3) * 100, 100)}%`, height: '100%', background: '#ec4899' }} />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: resolvedReports >= 1 ? 1 : 0.4 }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: resolvedReports >= 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: `2px solid ${resolvedReports >= 1 ? 'var(--status-low)' : 'var(--card-border)'}` }}>
                {resolvedReports >= 1 ? <CheckCircle2 size={40} color="var(--status-low)" /> : <CheckCircle2 size={40} color="var(--text-secondary)" />}
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Impact Maker</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Have 1 of your reported issues resolved.</p>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', opacity: resolvedReports >= 3 ? 1 : 0.4 }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: resolvedReports >= 3 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: `2px solid ${resolvedReports >= 3 ? 'var(--status-medium)' : 'var(--card-border)'}` }}>
                {resolvedReports >= 3 ? <Award size={40} color="var(--status-medium)" /> : <Award size={40} color="var(--text-secondary)" />}
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Community Hero</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Have 3 of your reported issues resolved.</p>
              <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((resolvedReports / 3) * 100, 100)}%`, height: '100%', background: 'var(--status-medium)' }} />
              </div>
            </div>
          </div>
        </div>
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
                      <strong>🎯 Assigned To:</strong> {report.assignedNgos?.map(n=>n.name).join(', ') || report.assignedNgoName || 'Unknown NGO'} <br/>
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
                <label className="form-label">Your Location</label>
                <input type="text" className="form-input" required value={updateLocation} onChange={(e) => setUpdateLocation(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={updatingProfile}>
                {updatingProfile ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save Profile</>}
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

            <div className="glass-panel" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>NGO Affiliations</h3>
                <span className="badge badge-low">{currentSlots} / 3 Slots Used</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                You can request to join up to 3 NGOs based on your interests and location. 
                When those NGOs receive tasks, you will be part of their active team.
              </p>

              {fetchingNgos ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /></div>
              ) : availableNgos.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No NGOs registered.</div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                  {availableNgos.map(ngo => {
                    const isApproved = approvedNgos.includes(ngo.id);
                    const isPending = pendingNgos.includes(ngo.id);
                    
                    return (
                      <div key={ngo.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{ngo.ngoName} <span style={{fontSize: '0.8rem', color: 'var(--primary-color)'}}>#{ngo.publicId}</span></div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ngo.coverageLocality} • {ngo.interests?.join(', ') || 'General'}</div>
                          </div>
                          <div>
                            {isApproved && <span className="badge badge-low">Approved</span>}
                            {isPending && <span className="badge badge-medium">Pending</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {ngo.volunteerCount} Volunteers
                          </div>
                          <div>
                            {!isApproved && !isPending && (
                              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleNgoAction(ngo.id, 'join')}>
                                <UserPlus size={14} style={{ marginRight: '0.25rem' }}/> Request Join
                              </button>
                            )}
                            {isPending && (
                              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleNgoAction(ngo.id, 'cancel')}>
                                Cancel Request
                              </button>
                            )}
                            {isApproved && (
                              <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'var(--status-critical-bg)', color: 'var(--status-critical)', border: '1px solid rgba(239, 68, 68, 0.3)' }} onClick={() => handleNgoAction(ngo.id, 'leave')}>
                                <LogOut size={14} style={{ marginRight: '0.25rem' }}/> Leave NGO
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
