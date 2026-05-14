import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import { useUserType } from './hooks/useUserType';

import Login from './pages/Login';
import CommitteeDashboard from './pages/CommitteeDashboard';
import CallRoomPanel from './pages/CallRoomPanel';
import FinishLinePanel from './pages/FinishLinePanel';
import TimekeeperPanel from './pages/TimekeeperPanel';
import InstitutionDashboard from './pages/InstitutionDashboard';
import PublicResults from './pages/PublicResults';
import DownloadPage from './pages/DownloadPage';

function ProtectedDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('committee');
  const navigate = useNavigate();

  const {
    committeeMember,
    institution,
    isCommittee,
    isInstitution,
    hasDualRole,
    isAdmin,
    isSuperAdmin,
    loading: userTypeLoading,
  } = useUserType(user);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        navigate('/login');
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userTypeLoading) {
      if (isCommittee) {
        setActiveView('committee');
      } else if (isInstitution) {
        setActiveView('institution');
      }
    }
  }, [userTypeLoading, isCommittee, isInstitution]);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login');
      setLoading(false);
      return;
    }
    setUser(session.user);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/login');
  }

  if (loading || userTypeLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isCommittee && !isInstitution) {
    return (
      <div className="container" style={{ padding: 20, textAlign: 'center' }}>
        <h2>حسابك غير مفعّل</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          البريد: {user?.email}
        </p>
        <p style={{ marginBottom: 20 }}>
          يرجى التواصل مع لجنة التنظيم لتفعيل حسابك.
        </p>
        <button onClick={handleLogout} className="btn btn-outline">
          خروج
        </button>
      </div>
    );
  }

  if (committeeMember?.role === 'call_room') {
    return <CallRoomPanel user={user} onLogout={handleLogout} />;
  }

  if (committeeMember?.role === 'finish_judge') {
    return (
      <FinishLinePanel
        user={user}
        committeeMember={committeeMember}
        onLogout={handleLogout}
      />
    );
  }

  if (committeeMember?.role === 'timekeeper') {
    return (
      <TimekeeperPanel
        user={user}
        committeeMember={committeeMember}
        onLogout={handleLogout}
      />
    );
  }

  if (activeView === 'committee' && isCommittee) {
    return (
      <CommitteeDashboard
        userType={{ ...committeeMember, type: 'committee' }}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        hasDualRole={hasDualRole}
        onSwitchToInstitution={() => setActiveView('institution')}
        onLogout={handleLogout}
      />
    );
  }

  if (activeView === 'institution' && isInstitution) {
    return (
      <InstitutionDashboard
        institution={institution}
        hasDualRole={hasDualRole}
        onSwitchToCommittee={() => setActiveView('committee')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="loading">
      <div className="spinner"></div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedDashboard />} />
      <Route path="/results" element={<PublicResults />} />
      <Route path="/d" element={<DownloadPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
