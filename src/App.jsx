import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import VolunteerDashboard from './components/VolunteerDashboard';
import AdminDashboard from './components/AdminDashboard';
import Topbar from './components/Topbar';

function App() {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <Auth />;
  }

  // Prevent infinite redirect loop if userRole failed to load
  if (currentUser && !userRole) {
    return <div className="container" style={{textAlign: 'center', marginTop: '4rem'}}>Determining account details...</div>;
  }

  return (
    <div>
      <Topbar />
      <Routes>
        <Route 
          path="/" 
          element={
            userRole === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/volunteer" replace />
            )
          } 
        />
        <Route 
          path="/volunteer" 
          element={
            userRole === 'volunteer' ? <VolunteerDashboard /> : <Navigate to="/" replace />
          } 
        />
        <Route 
          path="/admin" 
          element={
            userRole === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />
          } 
        />
      </Routes>
    </div>
  );
}

export default App;
