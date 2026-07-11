'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { Search, Plus, Trash2, Edit, X, AlertTriangle, Download, Upload } from 'lucide-react';

export default function NvlPage() {
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [toasts, setToasts] = useState([]);
    
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);

    const handleDownloadTemplate = async () => {
        try {
            const token = localStorage.getItem('token');
            const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
                ? 'http://' + window.location.hostname + ':3102'
                : '';
            const url = `${API_BASE}/api/nvl/template`;
            
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!res.ok) {
                throw new Error('Không thể tải file mẫu');
            }
            
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'mau_import_nvl.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
            toast('Tải file mẫu thành công');
        } catch (err) {
            toast('Lỗi tải file mẫu: ' + err.message, 'error');
        }
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const token = localStorage.getItem('token');
            const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
                ? 'http://' + window.location.hostname + ':3102'
                : '';
            const url = `${API_BASE}/api/nvl/import`;
            
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || 'Import thất bại');
            }
            
            toast(result.message || 'Import dữ liệu thành công!');
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        ma_nvl: '',
        ten_nvl: '',
        quy_cach: '',
        dvt: '',
        ghi_chu: '',
        ton_kho_ban_dau: 0,
        min_inventory: 10
    });

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchApi('/api/nvl');
            setRecords(data || []);
        } catch (err) {
            toast('Lỗi tải danh sách NVL: ' + err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredRecords = useMemo(() => {
        if (!searchTerm) return records;
        const term = searchTerm.toLowerCase();
        return records.filter(r =>
            (r.ten_nvl || '').toLowerCase().includes(term) ||
            (r.ma_nvl || '').toLowerCase().includes(term) ||
            (r.quy_cach || '').toLowerCase().includes(term) ||
            (r.ghi_chu || '').toLowerCase().includes(term)
        );
    }, [records, searchTerm]);

    const handleOpenAddModal = () => {
        setIsEditMode(false);
        setFormData({
            ma_nvl: '',
            ten_nvl: '',
            quy_cach: '',
            dvt: '',
            ghi_chu: '',
            ton_kho_ban_dau: 0,
            min_inventory: 10
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (item) => {
        setIsEditMode(true);
        setCurrentId(item.id);
        setFormData({
            ma_nvl: item.ma_nvl,
            ten_nvl: item.ten_nvl,
            quy_cach: item.quy_cach,
            dvt: item.dvt,
            ghi_chu: item.ghi_chu,
            ton_kho_ban_dau: item.ton_kho_ban_dau,
            min_inventory: item.min_inventory
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await fetchApi(`/api/nvl/${currentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                toast('Cập nhật vật tư thành công');
            } else {
                await fetchApi('/api/nvl', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                toast('Thêm vật tư mới thành công');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bạn có chắc chắn muốn xóa vật tư này không? Hành động này cũng sẽ xóa các định mức liên quan.')) return;
        try {
            await fetchApi(`/api/nvl/${id}`, { method: 'DELETE' });
            toast('Đã xóa vật tư thành công');
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (!hasPermission('nvl')) {
        return (
            <div className="page-content">
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                    Access denied
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
                    <h2>Nguyên Vật Liệu</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Danh sách các vật tư, quy cách và tồn kho hiện có</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportExcel} 
                        accept=".xlsx,.xls" 
                        style={{ display: 'none' }} 
                    />
                    <button 
                        className="btn btn-secondary" 
                        onClick={handleDownloadTemplate} 
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                        <Download size={16} /> Tải file mẫu
                    </button>
                    <button 
                        className="btn btn-success" 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={importing}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    >
                        <Upload size={16} /> {importing ? 'Đang import...' : 'Import Excel'}
                    </button>
                    <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={16} /> Thêm vật tư mới
                    </button>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="card" style={{ padding: 20 }}>
                {/* Search & Statistics */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
                            Tổng số: {filteredRecords.length} vật tư
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: 32, width: 250 }}
                                placeholder="Tìm kiếm vật tư..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="table-wrapper" style={{ height: 'calc(100vh - 230px)', overflowY: 'auto' }}>
                    <table className="table" style={{ fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>#</th>
                                <th>Mã NVL</th>
                                <th>Tên nguyên vật liệu</th>
                                <th>Quy cách</th>
                                <th style={{ textAlign: 'center' }}>ĐVT</th>
                                <th style={{ textAlign: 'right' }}>Tồn ban đầu</th>
                                <th style={{ textAlign: 'right' }}>Tồn hiện tại</th>
                                <th style={{ textAlign: 'right' }}>Mức an toàn</th>
                                <th>Ghi chú</th>
                                <th style={{ textAlign: 'center', width: 100 }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu...</td></tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Không tìm thấy vật tư nào</td></tr>
                            ) : filteredRecords.map((r, i) => {
                                return (
                                    <tr key={r.id}>
                                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                        <td style={{ color: 'var(--text-primary)' }}>{r.ma_nvl}</td>
                                        <td>{r.ten_nvl}</td>
                                        <td>{r.quy_cach || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.dvt}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{r.ton_kho_ban_dau}</td>
                                        <td style={{
                                            textAlign: 'right',
                                            color: '#059669'
                                        }}>
                                            {r.ton_kho_hien_tai}
                                        </td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.min_inventory}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.ghi_chu || '-'}</td>
                                        <td>
                                            <div className="actions" style={{ justifyContent: 'center' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(r)} style={{ padding: '4px 8px' }}>
                                                    <Edit size={14} />
                                                </button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)} style={{ padding: '4px 8px' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {isEditMode ? <Edit size={20} style={{ marginRight: 8 }} /> : <Plus size={20} style={{ marginRight: 8 }} />}
                                {isEditMode ? 'Chỉnh sửa vật tư' : 'Thêm vật tư mới'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Mã vật tư (Bỏ trống để tạo tự động)</label>
                                    <input
                                        className="form-input"
                                        placeholder="Ví dụ: NVL-001"
                                        value={formData.ma_nvl}
                                        onChange={e => setFormData({ ...formData, ma_nvl: e.target.value })}
                                        disabled={isEditMode}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tên vật tư</label>
                                    <input
                                        className="form-input"
                                        placeholder="Nhập tên vật tư..."
                                        value={formData.ten_nvl}
                                        onChange={e => setFormData({ ...formData, ten_nvl: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Quy cách</label>
                                    <input
                                        className="form-input"
                                        placeholder="Ví dụ: 20kg/Thùng"
                                        value={formData.quy_cach}
                                        onChange={e => setFormData({ ...formData, quy_cach: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Đơn vị tính (ĐVT)</label>
                                    <input
                                        className="form-input"
                                        placeholder="Ví dụ: Thùng, Lon, kg..."
                                        value={formData.dvt}
                                        onChange={e => setFormData({ ...formData, dvt: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Tồn kho ban đầu</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        step="any"
                                        placeholder="0"
                                        value={formData.ton_kho_ban_dau}
                                        onChange={e => setFormData({ ...formData, ton_kho_ban_dau: parseFloat(e.target.value || 0) })}
                                        disabled={isEditMode}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ngưỡng báo động tồn tối thiểu</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        step="any"
                                        placeholder="10"
                                        value={formData.min_inventory}
                                        onChange={e => setFormData({ ...formData, min_inventory: parseFloat(e.target.value || 0) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ghi chú</label>
                                <textarea
                                    className="form-input"
                                    placeholder="Ghi chú thêm..."
                                    rows={3}
                                    value={formData.ghi_chu}
                                    onChange={e => setFormData({ ...formData, ghi_chu: e.target.value })}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>Hủy</button>
                                <button className="btn btn-primary" type="submit">Lưu lại</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
