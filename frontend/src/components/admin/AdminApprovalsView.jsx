import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  SearchIcon,
  RefreshIcon,
  ShieldCheckIcon,
  HistoryIcon,
  ClockIcon,
  InboxIcon,
  CloseIcon,
} from '../common/Icons';

export function AdminApprovalsView() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'all' | 'active' | 'rejected'
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Modals state
  const [approvingUser, setApprovingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('advisor');
  const [isSubmittingApprove, setIsSubmittingApprove] = useState(false);

  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Audit Logs drawer state
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await adminApi.getApprovals({
        status: statusFilter,
        search,
        page,
        limit,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách phê duyệt tài khoản.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, page, limit]);

  useEffect(() => {
    let ignore = false;
    adminApi.getApprovals({
      status: statusFilter,
      search,
      page,
      limit,
    }).then((res) => {
      if (!ignore) {
        setItems(res.items || []);
        setTotal(res.total || 0);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (!ignore) {
        setError(err.message || 'Không thể tải danh sách phê duyệt tài khoản.');
        setIsLoading(false);
      }
    });
    return () => { ignore = true; };
  }, [statusFilter, search, page, limit]);

  const handleOpenApproveModal = (user) => {
    setApprovingUser(user);
    setSelectedRole(user.role || 'advisor');
    setError('');
  };

  const handleConfirmApprove = async () => {
    if (!approvingUser) return;
    setIsSubmittingApprove(true);
    setError('');
    try {
      await adminApi.approveUser(approvingUser.user_id, selectedRole);
      setActionSuccess(`Đã phê duyệt tài khoản "${approvingUser.display_name}" thành công với vai trò ${selectedRole}.`);
      setApprovingUser(null);
      await fetchApprovals();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Phê duyệt thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  const handleOpenRejectModal = (user) => {
    setRejectingUser(user);
    setRejectionReason('');
    setRejectError('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingUser) return;
    if (!rejectionReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối (bắt buộc).');
      return;
    }
    setIsSubmittingReject(true);
    setRejectError('');
    try {
      await adminApi.rejectUser(rejectingUser.user_id, rejectionReason.trim());
      setActionSuccess(`Đã từ chối yêu cầu của "${rejectingUser.display_name}".`);
      setRejectingUser(null);
      await fetchApprovals();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setRejectError(err.message || 'Từ chối thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleLoadAuditLogs = async () => {
    setShowAuditLogs(true);
    setIsLoadingAudit(true);
    try {
      const logs = await adminApi.getAuditLogs();
      setAuditLogs(logs || []);
    } catch {
      // Ignored
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return ts;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span style={{
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            padding: '3px 9px',
            borderRadius: 9999,
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            Đã kích hoạt (Active)
          </span>
        );
      case 'rejected':
        return (
          <span style={{
            backgroundColor: '#FEE2E2',
            color: '#B91C1C',
            padding: '3px 9px',
            borderRadius: 9999,
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            Bị từ chối (Rejected)
          </span>
        );
      default:
        return (
          <span style={{
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            padding: '3px 9px',
            borderRadius: 9999,
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            Chờ phê duyệt (Pending)
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: '20px 24px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheckIcon style={{ width: 22, height: 22, color: '#0F172A' }} />
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Quản trị & Phê duyệt Tài khoản Nhân viên
            </h1>
          </div>
          <p style={{ fontSize: '0.86rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Quy trình HITL: Kiểm duyệt hồ sơ đăng ký nhân viên Showroom, phân quyền vai trò (Advisor/Manager) và lưu vết audit log theo quy định VinFast.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={fetchApprovals}
            disabled={isLoading}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshIcon style={{ width: 14, height: 14 }} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleLoadAuditLogs}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><HistoryIcon style={{ width: 14, height: 14 }} /> Lịch sử kiểm duyệt (Audit Trail)</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircleIcon style={{ width: 18, height: 18, color: '#059669' }} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <AlertCircleIcon style={{ width: 18, height: 18, color: '#DC2626' }} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Status filter tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: '#F1F5F9',
          borderRadius: 10,
          padding: 3,
          gap: 4
        }}>
          {[
            { id: 'pending', label: 'Chờ duyệt (Pending)' },
            { id: 'active', label: 'Đã kích hoạt (Active)' },
            { id: 'rejected', label: 'Đã từ chối (Rejected)' },
            { id: 'all', label: 'Tất cả' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setStatusFilter(tab.id); setPage(1); }}
              style={{
                padding: '7px 14px',
                borderRadius: 7,
                border: 'none',
                background: statusFilter === tab.id ? '#FFFFFF' : 'transparent',
                fontWeight: statusFilter === tab.id ? 700 : 500,
                color: statusFilter === tab.id ? '#0F172A' : '#64748B',
                boxShadow: statusFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: 280 }}>
          <span style={{ position: 'absolute', left: 12, top: 10, color: '#94A3B8' }}>
            <SearchIcon style={{ width: 15, height: 15 }} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo họ tên hoặc email…"
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              backgroundColor: '#FFFFFF',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        {isLoading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#64748B' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', backgroundColor: '#FEF3C7', color: '#D97706', marginBottom: 8 }}><ClockIcon style={{ width: 20, height: 20 }} /></span>
            <div>Đang tải danh sách tài khoản…</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', backgroundColor: '#F1F5F9', color: '#64748B', marginBottom: 10 }}><InboxIcon style={{ width: 24, height: 24 }} /></div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
              Không có tài khoản nào trong danh mục này
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>
              {statusFilter === 'pending'
                ? 'Tuyệt vời! Hiện tại không có yêu cầu đăng ký nào đang chờ duyệt.'
                : 'Thử đổi bộ lọc hoặc xóa từ khóa tìm kiếm để xem thêm.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th style={{ padding: '14px 18px' }}>Tư vấn viên</th>
                  <th style={{ padding: '14px 18px' }}>Email / Username</th>
                  <th style={{ padding: '14px 18px' }}>Ngày đăng ký</th>
                  <th style={{ padding: '14px 18px' }}>Trạng thái</th>
                  <th style={{ padding: '14px 18px' }}>Vai trò</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr
                    key={user.user_id}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          backgroundColor: '#0F172A',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {user.display_name?.slice(0, 2).toUpperCase() || 'TV'}
                        </div>
                        <div>
                          <strong style={{ color: '#0F172A', display: 'block' }}>{user.display_name}</strong>
                          <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>ID: {user.user_id}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <code style={{ color: '#0284C7', backgroundColor: '#F0F9FF', padding: '3px 8px', borderRadius: 4, fontSize: '0.82rem' }}>
                        {user.email || user.username}
                      </code>
                    </td>

                    <td style={{ padding: '14px 18px', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(user.created_at)}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {getStatusBadge(user.status)}
                      {user.status === 'rejected' && user.rejection_reason && (
                        <div style={{ fontSize: '0.74rem', color: '#B91C1C', marginTop: 4 }}>
                          Lý do: <em>{user.rejection_reason}</em>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        textTransform: 'capitalize',
                        fontWeight: 600,
                        color: user.role === 'manager' ? '#7C3AED' : user.role === 'admin' ? '#C026D3' : '#334155'
                      }}>
                        {user.role}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {user.status === 'pending' ? (
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenApproveModal(user)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: 'none',
                              backgroundColor: '#059669',
                              color: '#FFFFFF',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <CheckCircleIcon style={{ width: 13, height: 13 }} />
                            <span>Phê duyệt</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(user)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid #FCA5A5',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            Từ chối
                          </button>
                        </div>
                      ) : user.status === 'active' ? (
                        <span style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 600 }}>
                          Đã duyệt ({user.reviewed_by || 'Admin'})
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                          Đã từ chối ({formatTimestamp(user.reviewed_at)})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8FAFC',
          fontSize: '0.84rem',
          color: '#64748B'
        }}>
          <div>
            Hiển thị <strong>{items.length}</strong> trên tổng số <strong>{total}</strong> tài khoản
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                backgroundColor: page <= 1 ? '#F1F5F9' : '#FFFFFF',
                color: page <= 1 ? '#94A3B8' : '#334155',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              ← Trang trước
            </button>
            <span style={{ padding: '6px 10px', fontWeight: 700, color: '#0F172A' }}>
              Trang {page}
            </span>
            <button
              type="button"
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                backgroundColor: page * limit >= total ? '#F1F5F9' : '#FFFFFF',
                color: page * limit >= total ? '#94A3B8' : '#334155',
                cursor: page * limit >= total ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              Trang sau →
            </button>
          </div>
        </div>
      </div>

      {/* APPROVE CONFIRMATION MODAL */}
      {approvingUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: '24px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0' }}>
              Xác nhận phê duyệt tài khoản
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Bạn đang chuẩn bị kích hoạt tài khoản cho nhân viên <strong>{approvingUser.display_name}</strong> (<code>{approvingUser.email || approvingUser.username}</code>).
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Phân quyền vai trò hệ thống:
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.88rem',
                  outline: 'none'
                }}
              >
                <option value="advisor">Tư vấn viên bán hàng (Advisor)</option>
                <option value="manager">Quản lý Showroom (Manager)</option>
                <option value="admin">Quản trị viên Hệ thống (Admin)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                disabled={isSubmittingApprove}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isSubmittingApprove}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: isSubmittingApprove ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmittingApprove ? 'Đang kích hoạt…' : 'Xác nhận phê duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT CONFIRMATION MODAL WITH REQUIRED REASON */}
      {rejectingUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: '24px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991B1B', margin: '0 0 10px 0' }}>
              Từ chối yêu cầu đăng ký
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#475569', margin: '0 0 14px 0', lineHeight: 1.5 }}>
              Yêu cầu của <strong>{rejectingUser.display_name}</strong> sẽ bị từ chối và tài khoản sẽ không thể truy cập hệ thống.
            </p>

            {rejectError && (
              <div style={{
                backgroundColor: '#FEF2F2',
                color: '#B91C1C',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '0.82rem',
                marginBottom: 12
              }}>
                {rejectError}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Lý do từ chối * (Bắt buộc để thông báo cho người dùng):
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ví dụ: Không tìm thấy mã nhân viên trong danh sách Showroom VinFast..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: '0.86rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectingUser(null)}
                disabled={isSubmittingReject}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject || !rejectionReason.trim()}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: isSubmittingReject || !rejectionReason.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmittingReject ? 'Đang xử lý…' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL DRAWER */}
      {showAuditLogs && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            width: '100%',
            maxWidth: 720,
            maxHeight: '85vh',
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: '24px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Lịch sử kiểm duyệt tài khoản (Audit Trail)
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Ghi nhận đầy đủ các quyết định phê duyệt và từ chối từ Quản trị viên
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogs(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#64748B'
                }}
              >
                <CloseIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              {isLoadingAudit ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B' }}>
                  Đang tải nhật ký audit…
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B' }}>
                  Chưa có sự kiện kiểm duyệt nào được ghi nhận.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        fontSize: '0.84rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            backgroundColor: log.action === 'approve' ? '#DCFCE7' : '#FEE2E2',
                            color: log.action === 'approve' ? '#15803D' : '#B91C1C',
                            textTransform: 'uppercase'
                          }}>
                            {log.action === 'approve' ? 'Phê duyệt' : 'Từ chối'}
                          </span>
                          <strong style={{ color: '#0F172A' }}>Tài khoản: {log.user_id}</strong>
                        </div>
                        <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                          {formatTimestamp(log.created_at)}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                        Người duyệt: <strong>{log.reviewer_name}</strong> (<code>{log.reviewer_id}</code>) • Chuyển từ <em>{log.previous_status}</em> → <strong>{log.new_status}</strong> (Vai trò: {log.assigned_role})
                      </div>

                      {log.rejection_reason && (
                        <div style={{ fontSize: '0.78rem', color: '#B91C1C', backgroundColor: '#FEF2F2', padding: '4px 8px', borderRadius: 4 }}>
                          Lý do: {log.rejection_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ paddingTop: 16, borderTop: '1px solid #E2E8F0', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowAuditLogs(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminApprovalsView;
