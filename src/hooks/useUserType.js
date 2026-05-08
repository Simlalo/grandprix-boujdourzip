import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

/**
 * Hook لكشف نوع المستخدم
 * يدعم الدور المزدوج: مستخدم يمكن أن يكون عضو لجنة + ممثل مؤسسة في نفس الوقت
 */
export function useUserType(user) {
  const [committeeMember, setCommitteeMember] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCommitteeMember(null);
      setInstitution(null);
      setLoading(false);
      return;
    }

    detectUserType();
  }, [user]);

  async function detectUserType() {
    setLoading(true);

    // جلب بيانات اللجنة (إن وُجدت)
    const { data: memberData } = await supabase
      .from('committee_members')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    // جلب بيانات المؤسسة (إن وُجدت)
    const { data: instData } = await supabase
      .from('institutions')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    setCommitteeMember(memberData || null);
    setInstitution(instData || null);
    setLoading(false);
  }

  // الحالات المُشتقّة
  const isCommittee = !!committeeMember;
  const isInstitution = !!institution;
  const hasDualRole = isCommittee && isInstitution;
  const isAdmin = isCommittee && (committeeMember?.role === 'admin' || committeeMember?.role === 'super_admin');
  const isSuperAdmin = isCommittee && committeeMember?.role === 'super_admin';

  // userType كـ object للتوافق مع الكود القديم
  // إذا كان عضو لجنة → نُرجع بياناته
  // وإلا → نُرجع بيانات المؤسسة
  const userType = committeeMember
    ? { type: 'committee', ...committeeMember }
    : institution
    ? { type: 'institution', ...institution }
    : null;

  return {
    userType,           // للتوافق مع الكود القديم
    committeeMember,    // بيانات اللجنة (null إن لم يكن عضواً)
    institution,        // بيانات المؤسسة (null إن لم يكن ممثلاً)
    isCommittee,
    isInstitution,
    hasDualRole,
    isAdmin,
    isSuperAdmin,
    loading,
    refresh: detectUserType,
  };
}
