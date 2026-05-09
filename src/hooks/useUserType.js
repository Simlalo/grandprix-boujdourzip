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
    console.log('[useUserType] Starting detection for user:', user?.id);

    try {
      // جلب بيانات اللجنة (إن وُجدت)
      console.log('[useUserType] Querying committee_members...');
      const { data: memberData, error: memberError } = await supabase
        .from('committee_members')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (memberError) {
        console.error('[useUserType] Committee error:', memberError);
        alert('خطأ في جلب بيانات اللجنة: ' + memberError.message);
      }
      console.log('[useUserType] Committee result:', memberData);

      // جلب بيانات المؤسسة (إن وُجدت)
      console.log('[useUserType] Querying institutions...');
      const { data: instData, error: instError } = await supabase
        .from('institutions')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (instError) {
        console.error('[useUserType] Institution error:', instError);
        alert('خطأ في جلب بيانات المؤسسة: ' + instError.message);
      }
      console.log('[useUserType] Institution result:', instData);

      setCommitteeMember(memberData || null);
      setInstitution(instData || null);
      console.log('[useUserType] Detection complete. Setting loading=false');
    } catch (e) {
      console.error('[useUserType] Unexpected error:', e);
      alert('خطأ غير متوقع: ' + e.message);
    } finally {
      setLoading(false);
    }
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
