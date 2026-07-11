'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { Search, Plus, Trash2, Edit, X, Shield, UserCheck, UserX, KeyRound } from 'lucide-react';

const PERMISSION_OPTIONS = [
    { key: 'dashboard', label: 'Tổng quan (Dashboard)' },
    { key: 'tinh-toan', label: 'Tạo lệnh sản xuất' },
    { key: 'dinh-muc', label: 'Định mức sản phẩm' },
    { key: 'nvl', label: 'Vật tư (NVL)' },
    { key: 'nvl-transactions', label: 'Nhập xuất NVL' },
    { key: 'san-pham', label: 'Sản phẩm' },
    { key: 'sp-transactions', label: 'Nhập xuất SP' },
];

export default function UsersPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterActive, setFilterActive] = useState('');
    const [toasts, setToasts] = useState([]);

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    
    const [currentId, setCurrentId] = useState(null);
    const [currentUsername, setCurrentUsername] = useState('');

    // Form data
    const [addForm, setAddForm] = useState({
        email: '',
        password: '',
        display_name: '',
        role: 'user',
        is_active: true,
        permissions: []
    });

    const [editForm, setEditForm] = useState({
        email: '',
        display_name: '',
        role: 'user',
        is_active: true,
        permissions: []
    });

    const [passwordForm, setPasswordForm] = useState({
        password: '',
        confirmPassword: ''
    });

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchApi('/api/users');
            setRecords(data || []);
        } catch (err) {
            toast('Lỗi tải danh sách tài khoản: ' + err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (user && user.role === 'admin') {
            loadData();
        }
    }, [user]);

    const filteredRecords = useMemo(() => {
        let list = records;

        if (filterRole) {
            list = list.filter(r => r.role === filterRole);
        }

        if (filterActive !== '') {
            const activeVal = filterActive === 'true' ? 1 : 0;
            list = list.filter(r => r.is_active === activeVal);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(r => 
                (r.username || '').toLowerCase().includes(term) ||
                (r.email || '').toLowerCase().includes(term) ||
                (r.display_name || '').toLowerCase().includes(term)
            );
        }

        return list;
    }, [records, searchTerm, filterRole, filterActive]);

    // Handle add form permission toggle
    const handleAddPermissionToggle = (key) => {
        setAddForm(prev => {
            const index = prev.permissions.indexOf(key);
            let updated = [...prev.permissions];
            if (index > -1) {
                updated.splice(index, 1);
            } else {
                updated.push(key);
            }
            return { ...prev, permissions: updated };
        });
    };

    // Toggle all permissions for add form
    const isAddAllChecked = addForm.permissions.length === PERMISSION_OPTIONS.length;
    const handleAddToggleAllPermissions = () => {
        setAddForm(prev => {
            const isAll = prev.permissions.length === PERMISSION_OPTIONS.length;
            return {
                ...prev,
                permissions: isAll ? [] : PERMISSION_OPTIONS.map(opt => opt.key)
            };
        });
    };

    // Handle edit form permission toggle
    const handleEditPermissionToggle = (key) => {
        setEditForm(prev => {
            const index = prev.permissions.indexOf(key);
            let updated = [...prev.permissions];
            if (index > -1) {
                updated.splice(index, 1);
            } else {
                updated.push(key);
            }
            return { ...prev, permissions: updated };
        });
    };

    // Toggle all permissions for edit form
    const isEditAllChecked = editForm.permissions.length === PERMISSION_OPTIONS.length;
    const handleEditToggleAllPermissions = () => {
        setEditForm(prev => {
            const isAll = prev.permissions.length === PERMISSION_OPTIONS.length;
            return {
                ...prev,
                permissions: isAll ? [] : PERMISSION_OPTIONS.map(opt => opt.key)
            };
        });
    };

    const handleOpenAddModal = () => {
        setAddForm({
            email: '',
            password: '',
            display_name: '',
            role: 'user',
            is_active: true,
            permissions: []
        });
        setShowAddModal(true);
    };

    const handleOpenEditModal = (item) => {
        setCurrentId(item.id);
        setEditForm({
            email: item.email || '',
            display_name: item.display_name || '',
            role: item.role || 'user',
            is_active: item.is_active === 1 || item.is_active === true,
            permissions: item.permissions || []
        });
        setShowEditModal(true);
    };

    const handleOpenPasswordModal = (item) => {
        setCurrentId(item.id);
        setCurrentUsername(item.username);
        setPasswordForm({
            password: '',
            confirmPassword: ''
        });
        setShowPasswordModal(true);
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (addForm.password.length < 6) {
            toast('Mật khẩu phải chứa ít nhất 6 ký tự', 'error');
            return;
        }
        try {
            await fetchApi('/api/users', {
                method: 'POST',
                body: JSON.stringify(addForm)
            });
            toast('Tạo tài khoản thành công');
            setShowAddModal(false);
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await fetchApi(`/api/users/${currentId}`, {
                method: 'PUT',
                body: JSON.stringify(editForm)
            });
            toast('Cập nhật tài khoản thành công');
            setShowEditModal(false);
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordForm.password.length < 6) {
            toast('Mật khẩu phải chứa ít nhất 6 ký tự', 'error');
            return;
        }
        if (passwordForm.password !== passwordForm.confirmPassword) {
            toast('Xác nhận mật khẩu không khớp', 'error');
            return;
        }
        try {
            await fetchApi(`/api/users/${currentId}/password`, {
                method: 'PUT',
                body: JSON.stringify({ password: passwordForm.password })
            });
            toast('Đổi mật khẩu thành công');
            setShowPasswordModal(false);
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleDelete = async (id, name) => {
        if (id === user?.id) {
            toast('Bạn không thể tự xóa tài khoản của chính mình', 'error');
            return;
        }
        if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản '${name}' không? Hành động này không thể hoàn tác.`)) return;
        try {
            await fetchApi(`/api/users/${id}`, { method: 'DELETE' });
            toast('Đã xóa tài khoản thành công');
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (!user || user.role !== 'admin') {
        return (
            <div className="page-content">
                <div className="card" style={{ padding: '40px', textAlign: 'center', marginTop: '20px' }}>
                    <Shield size={48} style={{ color: 'var(--danger)', marginBottom: '16px' }} />
                    <h3 style={{ marginBottom: '8px' }}>Từ chối truy cập</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Chức năng này yêu cầu quyền quản trị viên cao cấp.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-content">
            {/* Toasts */}
            <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        padding: '10px 16px', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500,
                        background: t.type === 'error' ? 'var(--danger)' : 'var(--success)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'fadeIn 0.3s ease'
                    }}>{t.message}</div>
                ))}
            </div>

            {/* Page Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Quản lý Tài Khoản</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                        Tạo lập tài khoản nhân viên, phân quyền truy cập chức năng và đổi mật khẩu hệ thống
                    </p>
                </div>
                <div>
                    <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={16} /> Thêm tài khoản mới
                    </button>
                </div>
            </div>

            {/* Filters and List */}
            <div className="card" style={{ padding: 20 }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Filter Role */}
                        <select className="form-select" style={{ width: 180 }}
                            value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                            <option value="">-- Vai trò (Tất cả) --</option>
                            <option value="admin">Quản trị viên (Admin)</option>
                            <option value="user">Nhân viên (User)</option>
                        </select>
                        {/* Filter Status */}
                        <select className="form-select" style={{ width: 180 }}
                            value={filterActive} onChange={e => setFilterActive(e.target.value)}>
                            <option value="">-- Trạng thái (Tất cả) --</option>
                            <option value="true">Đang hoạt động</option>
                            <option value="false">Đang bị khóa</option>
                        </select>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
                            Hiển thị: {filteredRecords.length} tài khoản
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: 32, width: 280 }}
                                placeholder="Tìm theo tên hiển thị, email..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Table list */}
                <div className="table-wrapper">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>#</th>
                                <th>Tên hiển thị (Họ tên)</th>
                                <th>Email</th>
                                <th>Vai trò</th>
                                <th>Trạng thái</th>
                                <th>Các quyền được cấp</th>
                                <th style={{ textAlign: 'center', width: 150 }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu nhân viên...</td></tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Không tìm thấy tài khoản nào</td></tr>
                            ) : (
                                filteredRecords.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td>{idx + 1}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {item.display_name || <em style={{ color: 'var(--text-muted)' }}>chưa đặt</em>}
                                        </td>
                                        <td>{item.email}</td>
                                        <td>
                                            {item.role === 'admin' ? (
                                                <span className="badge badge-danger">Admin</span>
                                            ) : (
                                                <span className="badge badge-info">Nhân viên</span>
                                            )}
                                        </td>
                                        <td>
                                            {item.is_active === 1 || item.is_active === true ? (
                                                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <UserCheck size={12} /> Hoạt động
                                                </span>
                                            ) : (
                                                <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <UserX size={12} /> Bị khóa
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {item.role === 'admin' ? (
                                                    <span style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                                        Tất cả các quyền
                                                    </span>
                                                ) : item.permissions && item.permissions.length > 0 ? (
                                                    item.permissions.map(f => {
                                                        const found = PERMISSION_OPTIONS.find(p => p.key === f);
                                                        return (
                                                            <span key={f} className="badge badge-success" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 6px', fontSize: '10.5px' }}>
                                                                {found ? found.label.split(' ')[0] : f}
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        Không có quyền nào
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="actions" style={{ justifyContent: 'center' }}>
                                                <button className="btn btn-secondary btn-icon" title="Sửa thông tin" onClick={() => handleOpenEditModal(item)}>
                                                    <Edit size={14} />
                                                </button>
                                                <button className="btn btn-secondary btn-icon" title="Đổi mật khẩu" onClick={() => handleOpenPasswordModal(item)}>
                                                    <KeyRound size={14} />
                                                </button>
                                                <button className="btn btn-secondary btn-icon" style={{ color: 'var(--danger)' }}
                                                    title="Xóa tài khoản" onClick={() => handleDelete(item.id, item.username)}
                                                    disabled={item.id === user?.id}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Add User */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '560px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Tạo Tài Khoản Mới</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Họ tên (Tên hiển thị) *</label>
                                    <input className="form-input" required placeholder="Ví dụ: Nguyễn Văn A"
                                        value={addForm.display_name} onChange={e => setAddForm(prev => ({ ...prev, display_name: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email liên hệ *</label>
                                    <input className="form-input" required type="email" placeholder="nva@example.com"
                                        value={addForm.email} onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))} />
                                </div>
                            </div>

                            <div className="form-row" style={{ marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Mật khẩu khởi tạo *</label>
                                    <input className="form-input" required type="password" placeholder="Tối thiểu 6 ký tự"
                                        value={addForm.password} onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vai trò tài khoản</label>
                                    <select className="form-select" value={addForm.role}
                                        onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value }))}>
                                        <option value="user">Nhân viên (User)</option>
                                        <option value="admin">Quản trị viên (Admin)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row" style={{ marginTop: 12 }}>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Trạng thái hoạt động</label>
                                    <select className="form-select" value={addForm.is_active ? 'true' : 'false'}
                                        onChange={e => setAddForm(prev => ({ ...prev, is_active: e.target.value === 'true' }))}>
                                        <option value="true">Đang hoạt động</option>
                                        <option value="false">Tạm khóa tài khoản</option>
                                    </select>
                                </div>
                            </div>

                            {addForm.role !== 'admin' && (
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Phân quyền chức năng</span>
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm" 
                                            style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', minHeight: 'unset' }}
                                            onClick={handleAddToggleAllPermissions}
                                        >
                                            {isAddAllChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                        </button>
                                    </label>
                                    <div className="checkbox-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        {PERMISSION_OPTIONS.map(opt => {
                                            const isChecked = addForm.permissions.includes(opt.key);
                                            return (
                                                <div key={opt.key} className="checkbox-item"
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderColor: isChecked ? 'var(--accent)' : 'var(--border-color)',
                                                        background: isChecked ? '#fffaf8' : 'white'
                                                    }}
                                                    onClick={() => handleAddPermissionToggle(opt.key)}>
                                                    <input type="checkbox" checked={isChecked} readOnly />
                                                    <label style={{ fontSize: '13px', margin: 0 }}>{opt.label}</label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Hủy bỏ</button>
                                <button type="submit" className="btn btn-primary">Tạo tài khoản</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Edit User */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '560px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Cập Nhật Thông Tin</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Tên hiển thị (Họ tên)</label>
                                    <input className="form-input" placeholder="Ví dụ: Nguyễn Văn A"
                                        value={editForm.display_name} onChange={e => setEditForm(prev => ({ ...prev, display_name: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email liên hệ *</label>
                                    <input className="form-input" required type="email" placeholder="nva@example.com"
                                        value={editForm.email} onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))} />
                                </div>
                            </div>

                            <div className="form-row" style={{ marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Vai trò tài khoản</label>
                                    <select className="form-select" value={editForm.role}
                                        onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}>
                                        <option value="user">Nhân viên (User)</option>
                                        <option value="admin">Quản trị viên (Admin)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Trạng thái hoạt động</label>
                                    <select className="form-select" value={editForm.is_active ? 'true' : 'false'}
                                        onChange={e => setEditForm(prev => ({ ...prev, is_active: e.target.value === 'true' }))}>
                                        <option value="true">Đang hoạt động</option>
                                        <option value="false">Tạm khóa tài khoản</option>
                                    </select>
                                </div>
                            </div>

                            {editForm.role !== 'admin' && (
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Phân quyền chức năng</span>
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm" 
                                            style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', minHeight: 'unset' }}
                                            onClick={handleEditToggleAllPermissions}
                                        >
                                            {isEditAllChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                        </button>
                                    </label>
                                    <div className="checkbox-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        {PERMISSION_OPTIONS.map(opt => {
                                            const isChecked = editForm.permissions.includes(opt.key);
                                            return (
                                                <div key={opt.key} className="checkbox-item"
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderColor: isChecked ? 'var(--accent)' : 'var(--border-color)',
                                                        background: isChecked ? '#fffaf8' : 'white'
                                                    }}
                                                    onClick={() => handleEditPermissionToggle(opt.key)}>
                                                    <input type="checkbox" checked={isChecked} readOnly />
                                                    <label style={{ fontSize: '13px', margin: 0 }}>{opt.label}</label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Hủy bỏ</button>
                                <button type="submit" className="btn btn-primary">Lưu thay đổi</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Reset Password */}
            {showPasswordModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Đặt Lại Mật Khẩu</h3>
                            <button className="modal-close" onClick={() => setShowPasswordModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handlePasswordSubmit}>
                            <div style={{ marginBottom: '16px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                                Đang đổi mật khẩu cho tài khoản: <strong style={{ color: 'var(--text-primary)' }}>{currentUsername}</strong>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mật khẩu mới *</label>
                                <input className="form-input" required type="password" placeholder="Tối thiểu 6 ký tự"
                                    value={passwordForm.password} onChange={e => setPasswordForm(prev => ({ ...prev, password: e.target.value }))} />
                            </div>
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label">Xác nhận mật khẩu mới *</label>
                                <input className="form-input" required type="password" placeholder="Nhập lại mật khẩu mới"
                                    value={passwordForm.confirmPassword} onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))} />
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Hủy bỏ</button>
                                <button type="submit" className="btn btn-primary">Đổi mật khẩu</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
