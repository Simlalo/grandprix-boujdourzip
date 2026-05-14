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

// ... (ProtectedDashboard كما هو بدون تغيير)

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
}    return (
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
