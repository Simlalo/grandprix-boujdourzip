import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const ROLE_LABELS = {
  super_admin: 'مدير عام',
  admin: 'مدير',
  data_entry: 'مُدخل نتائج',
  call_room: 'غرفة النداء',
  viewer: 'مشاهد',
};

const ROLE_COLORS = {
  super_admin: '#dc2626',
  admin: '#2563eb',
  data_entry: '#059669',
  call_room: '#d97706',
  viewer: '#6b7280',
};

export default function CommitteeMembersPanel({ currentMemberId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setLoading(true);
    const { data } = await supabase
      .from('committee_members')
      .select('id, full_name, role, auth_user_id, created_at, auth_user:auth_user_id')
      .order('role')
      .order('created_at');

    // جلب البريد لكل عضو
    if (data) {
      const userIds = data.map(m => m.auth_user_id);
      const { data: usersData } = await supabase
        .from('institutions')
        .select('auth_user_id, email, name')
        .in('auth_user_id', userIds);

      const usersMap = {};
      (usersData || []).forEach(u => {
        usersMap[u.auth_user_id] = { email: u.email, institution: u.name };
      });

      const enriched = data.map(m => ({
        ...m,
        institution: usersMap[m.auth_user_id]?.institution || null,
        institution_email: usersMap[m.auth_user_id]?.email || null,
      }));
      setMembers(enriched);
    }
    setLoading(false);
  }

  async function handleRemove(member) {
    if (!confirm(`حذف العضو "${member.full_name}" من اللجنة؟`)) return;

    const { data, error } = await supabase.rpc('super_admin_remove_member', {
      p_member_id: member.id,
    });

    if (error) {
      alert('خطأ: ' + error.message);
      return;
    }

    alert(data?.message || 'تم الحذف');
    await loadMembers();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>
          الأعضاء ({members.length})
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-accent"
          style={{ minHeight: 44, fontSize: 14, padding: '8px 16px' }}
        >
          + إضافة عضو
        </button>
      </div>

      <div className="list">
        {members.map(m => (
          <div key={m.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'white',
                background: ROLE_COLORS[m.role] || '#6b7280',
                padding: '3px 10px',
                borderRadius: 12,
              }}>
                {ROLE_LABELS[m.role] || m.role}
              </span>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{m.full_name}</div>
            </div>

            {m.institution && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 8 }}>
                🏫 يدير أيضاً: {m.institution}
              </div>
            )}

            {m.role !== 'super_admin' && m.id !== currentMemberId && (
              <button
                onClick={() => handleRemove(m)}
                className="btn btn-outline"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  color: 'var(--danger)',
                  borderColor: 'var(--danger)',
                  alignSelf: 'flex-start',
                }}
              >
                ✕ حذف الدور
              </button>
            )}
            {m.id === currentMemberId && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'flex-start' }}>
                (أنت)
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadMembers(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// نموذج إضافة عضو
// ═══════════════════════════════════════════════════════

function AddMemberModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState(''); // 'new' | 'existing'
  const [role, setRole] = useState('data_entry');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [existingUserId, setExistingUserId] = useState('');
  const [existingUsers, setExistingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'existing') {
      loadExistingUsers();
    }
  }, [mode]);

  async function loadExistingUsers() {
    // ممثلو المؤسسات الذين ليسوا أعضاء لجنة بعد
    const { data: institutions } = await supabase
      .from('institutions')
      .select('auth_user_id, name, responsible_name, email')
      .not('auth_user_id', 'is', null);

    const { data: members } = await supabase
      .from('committee_members')
      .select('auth_user_id');

    const memberIds = new Set((members || []).map(m => m.auth_user_id));
    const available = (institutions || []).filter(i => !memberIds.has(i.auth_user_id));
    setExistingUsers(available);
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  }

  async function handleSubmit() {
    setError('');

    if (!role) {
      setError('اختر الدور');
      return;
    }

    setLoading(true);

    if (mode === 'new') {
      if (!email || !password || !fullName) {
        setError('املأ كل الحقول');
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('super_admin_create_member', {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_role: role,
      });

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      alert(`تم إنشاء العضو بنجاح\n\nالبريد: ${email}\nكلمة المرور: ${password}\n\nاحفظ هذه البيانات!`);
      onSuccess();
    } else if (mode === 'existing') {
      if (!existingUserId) {
        setError('اختر مستخدماً');
        setLoading(false);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('super_admin_assign_role', {
        p_target_user_id: existingUserId,
        p_role: role,
      });

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      alert(data?.message || 'تم إسناد الدور');
      onSuccess();
    }

    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button onClick={onClose} className="modal-close">✕</button>
          <h3 className="modal-title">إضافة عضو</h3>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error mb-3">{error}</div>
          )}

          {!mode && (
            <div>
              <p style={{ marginBottom: 16, fontSize: 14 }}>
                هل الشخص لديه حساب مؤسسة بالفعل؟
              </p>
              <button
                onClick={() => setMode('existing')}
                className="btn btn-outline btn-block mb-2"
                style={{ minHeight: 56, textAlign: 'right' }}
              >
                <div style={{ fontWeight: 700 }}>✓ نعم — اختر من قائمة المؤسسات</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  يحتفظ بحسابه كممثل + يحصل على دور إضافي
                </div>
              </button>
              <button
                onClick={() => setMode('new')}
                className="btn btn-outline btn-block"
                style={{ minHeight: 56, textAlign: 'right' }}
              >
                <div style={{ fontWeight: 700 }}>+ لا — أنشئ حساباً جديداً</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  بريد جديد + كلمة مرور
                </div>
              </button>
            </div>
          )}

          {mode === 'existing' && (
            <div>
              <button onClick={() => setMode('')} className="btn btn-outline mb-3" style={{ fontSize: 12 }}>
                → رجوع
              </button>

              <div className="form-group">
                <label className="form-label">المستخدم</label>
                <select
                  className="form-select"
                  value={existingUserId}
                  onChange={(e) => setExistingUserId(e.target.value)}
                >
                  <option value="">— اختر —</option>
                  {existingUsers.map(u => (
                    <option key={u.auth_user_id} value={u.auth_user_id}>
                      {u.responsible_name} ({u.name})
                    </option>
                  ))}
                </select>
                {existingUsers.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    لا توجد مؤسسات متاحة (الكل أعضاء بالفعل)
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">الدور</label>
                <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="admin">مدير</option>
                  <option value="data_entry">مُدخل نتائج</option>
                  <option value="call_room">غرفة النداء</option>
                </select>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !existingUserId}
                className="btn btn-accent btn-block"
                style={{ minHeight: 56, fontSize: 16, fontWeight: 900 }}
              >
                {loading ? 'جاري الحفظ...' : '✓ إسناد الدور'}
              </button>
            </div>
          )}

          {mode === 'new' && (
            <div>
              <button onClick={() => setMode('')} className="btn btn-outline mb-3" style={{ fontSize: 12 }}>
                → رجوع
              </button>

              <div className="form-group">
                <label className="form-label">الاسم الكامل</label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثلاً: أحمد بن علي"
                />
              </div>

              <div className="form-group">
                <label className="form-label">البريد الإلكتروني</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@grandprix.ma"
                  dir="ltr"
                />
              </div>

              <div className="form-group">
                <label className="form-label">كلمة المرور</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '8px 14px' }}
                  >
                    🎲 توليد
                  </button>
                  <input
                    type="text"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة المرور"
                    dir="ltr"
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  احفظها — ستحتاجها لتسليمها للعضو
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">الدور</label>
                <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="admin">مدير</option>
                  <option value="data_entry">مُدخل نتائج</option>
                  <option value="call_room">غرفة النداء</option>
                </select>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !email || !password || !fullName}
                className="btn btn-accent btn-block"
                style={{ minHeight: 56, fontSize: 16, fontWeight: 900 }}
              >
                {loading ? 'جاري الإنشاء...' : '✓ إنشاء الحساب'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
