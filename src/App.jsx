import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import Login from './pages/Login';
import InstitutionDashboard from './pages/InstitutionDashboard';
import CommitteeDashboard from './pages/CommitteeDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkUserType(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkUserType(session.user.id);
      else {
        setUserType(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUserType(userId) {
    setLoading(true);

    const { data: committee } = await supabase
      .from('committee_members')
      .select('role')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (committee) {
      setUserType({ type: 'committee', role: committee.role });
      setLoading(false);
      return;
    }

    const { data: institution } = await supabase
      .from('institutions')
      .select('id, name')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (institution) {
      setUserType({ type: 'institution', ...institution });
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
      <Route
        path="/*"
        element={
          !session ? (
            <Navigate to="/login" />
          ) : userType?.type === 'committee' ? (
            <CommitteeDashboard userType={userType} />
          ) : userType?.type === 'institution' ? (
            <InstitutionDashboard institution={userType} />
          ) : (
            <UnknownUser />
          )
        }
      />
    </Routes>
  );
}

function UnknownUser() {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="card text-center">
        <h2 style={{ marginBottom: 12 }}>حساب غير معرّف</h2>
        <p className="text-muted mb-4">
          هذا الحساب غير مرتبط بأي مؤسسة أو لجنة.
          <br />يرجى التواصل مع لجنة التنظيم.
        </p>
        <button className="btn btn-primary btn-block" onClick={logout}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
