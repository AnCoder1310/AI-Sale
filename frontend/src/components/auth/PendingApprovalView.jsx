import { useState } from 'react';
import {
  AlertCircleIcon,
  RefreshIcon,
  LogoutIcon,
  ClockIcon,
  InfoIcon,
  BuildingIcon,
} from '../common/Icons';

export function PendingApprovalView({ user, onRecheckStatus, onLogout }) {
  const [isChecking, setIsChecking] = useState(false);
  const [notice, setNotice] = useState('');

  const isRejected = user?.status === 'rejected';

  const handleCheck = async () => {
    setIsChecking(true);
    setNotice('');
    try {
      if (onRecheckStatus) {
        await onRecheckStatus();
      }
      setNotice('Đã đồng bộ lại trạng thái tài khoản từ máy chủ.');
      setTimeout(() => setNotice(''), 3000);
    } catch {
      setNotice('Chưa thể kiểm tra lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8FAFC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 540,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}>
        {/* Header Banner */}
        <div style={{
          backgroundColor: isRejected ? '#FEF2F2' : '#F8FAFC',
          borderBottom: `1px solid ${isRejected ? '#FEE2E2' : '#E2E8F0'}`,
          padding: '28px 32px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: '50%',
            backgroundColor: isRejected ? '#FEE2E2' : '#FEF3C7',
            color: isRejected ? '#DC2626' : '#D97706',
            marginBottom: 12
          }}>
            {isRejected ? (
              <AlertCircleIcon style={{ width: 26, height: 26 }} />
            ) : (
              <ClockIcon style={{ width: 26, height: 26 }} />
            )}
          </div>

          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: isRejected ? '#991B1B' : '#0F172A',
            margin: '0 0 6px 0'
          }}>
            {isRejected ? 'Yêu cầu đăng ký bị từ chối' : 'Tài khoản đang chờ duyệt'}
          </h2>

          <p style={{
            fontSize: '0.84rem',
            color: isRejected ? '#7F1D1D' : '#64748B',
            margin: 0,
            lineHeight: 1.5
          }}>
            {isRejected
              ? 'Tài khoản không được cấp quyền truy cập hệ thống VinFast AI Sales Coach.'
              : 'Yêu cầu của bạn đã được ghi nhận. Quản trị viên sẽ phê duyệt và phân quyền.'}
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px' }}>
          {notice && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              color: '#1E40AF',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: '0.8rem',
              marginBottom: 16
            }}>
              <InfoIcon style={{ width: 14, height: 14 }} />
              <span>{notice}</span>
            </div>
          )}

          {/* User Details Box */}
          <div style={{
            backgroundColor: '#F8FAFC',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            padding: '16px',
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Họ và tên:</span>
              <strong style={{ color: '#0F172A' }}>{user?.display_name || 'Tư vấn viên'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Email:</span>
              <code style={{ color: '#0284C7', backgroundColor: '#E0F2FE', padding: '2px 8px', borderRadius: 4 }}>
                {user?.email || user?.username}
              </code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Trạng thái:</span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
                backgroundColor: isRejected ? '#FEE2E2' : '#FEF3C7',
                color: isRejected ? '#DC2626' : '#B45309',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                {isRejected ? <AlertCircleIcon style={{ width: 12, height: 12 }} /> : <ClockIcon style={{ width: 12, height: 12 }} />}
                {isRejected ? 'Bị từ chối' : 'Chờ phê duyệt'}
              </span>
            </div>
          </div>

          {/* Rejection Reason Notice */}
          {isRejected && user?.rejection_reason && (
            <div style={{
              backgroundColor: '#FEF2F2',
              borderRadius: 8,
              border: '1px solid #FCA5A5',
              padding: '14px',
              marginBottom: 20
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991B1B', marginBottom: 4 }}>
                LÝ DO TỪ CHỐI:
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#7F1D1D', lineHeight: 1.5 }}>
                “{user.rejection_reason}”
              </p>
            </div>
          )}

          {/* Internal Guidance Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 24,
            fontSize: '0.78rem',
            color: '#64748B'
          }}>
            <BuildingIcon style={{ width: 16, height: 16, color: '#64748B', flexShrink: 0 }} />
            <span>Hệ thống nội bộ — Tài khoản được kích hoạt bởi Quản trị viên showroom.</span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <LogoutIcon style={{ width: 14, height: 14 }} />
              <span>Đăng xuất</span>
            </button>

            {!isRejected && (
              <button
                type="button"
                onClick={handleCheck}
                disabled={isChecking}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: isChecking ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {isChecking ? (
                  <span>Đang kiểm tra…</span>
                ) : (
                  <>
                    <RefreshIcon style={{ width: 14, height: 14 }} />
                    <span>Kiểm tra trạng thái</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PendingApprovalView;
