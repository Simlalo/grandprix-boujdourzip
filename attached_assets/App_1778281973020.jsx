import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import LoginScreen from './components/LoginScreen';
import InstitutionDashboard from './components/InstitutionDashboard';
import CommitteeDashboard from './components/CommitteeDashboard';
import PublicResults from './components/PublicResults';

function MainApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState(null);
  const [member, setMember] = useState(null);
  // الواجهة النشطة عند مزدوج الدور: 'committee' أو 'institution'
  const [activeView, setActiveView] = useState('committee');

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        loadUserData(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setInstitution(null);
        setMember(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserData(session.user);
    }
    setLoading(false);
  }

  async function loadUserData(authUser) {
    setUser(authUser);

    // محاولة جلب بيانات المؤسسة
    const { data: instData } = await supabase
      .from('institutions')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();

    // محاولة جلب بيانات اللجنة
    const { data: memberData } = await supabase
      .from('committee_members')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();

    setInstitution(instData || null);
    setMember(memberData || null);

    // تحديد الواجهة الافتراضية:
    // إذا كان لديه دور لجنة → ابدأ بواجهة اللجنة
    // وإلا (مؤسسة فقط) → ابدأ بواجهة المؤسسة
    if (memberData) {
      setActiveView('committee');
    } else if (instData) {
      setActiveView('institution');
    }
  }

  async function handleLogin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserData(session.user);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setInstitution(null);
    setMember(null);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // التحقق من الأدوار
  const isCommittee = !!member;
  const isInstitution = !!institution;
  const hasDualRole = isCommittee && isInstitution;
  const isAdmin = isCommittee && (member?.role === 'admin' || member?.role === 'super_admin');
  const isSuperAdmin = isCommittee && member?.role === 'super_admin';

  // إذا لم يكن في أيٍ من الجدولين
  if (!isCommittee && !isInstitution) {
    return (
      <div className="container" style={{ padding: 20, textAlign: 'center' }}>
        <h2>حسابك غير مفعّل</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          البريد: {user.email}
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

  // عرض الواجهة النشطة
  if (activeView === 'committee' && isCommittee) {
    return (
      <CommitteeDashboard
        user={user}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onLogout={handleLogout}
        member={member}
        hasDualRole={hasDualRole}
        onSwitchToInstitution={() => setActiveView('institution')}
      />
    );
  }

  if (activeView === 'institution' && isInstitution) {
    return (
      <InstitutionDashboard
        user={user}
        institution={institution}
        onLogout={handleLogout}
        hasDualRole={hasDualRole}
        onSwitchToCommittee={() => setActiveView('committee')}
      />
    );
  }

  // حالة احتياطية: إذا activeView لا يطابق ما هو متاح
  return (
    <div className="loading">
      <div className="spinner"></div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/results" element={<PublicResults />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}
