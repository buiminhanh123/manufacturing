'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { Search, Plus, Trash2, Edit, X } from 'lucide-react';

export default function SanPhamPage() {
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBoPhan, setFilterBoPhan] = useState('');
    const [filterLoaiXe, setFilterLoaiXe] = useState('');
    const [toasts, setToasts] = useState([]);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        ma_sp: '',
        ten_sp: '',
        loai_xe: '',
        bo_phan: '',
        nguoi_phu_trach: '',
        ghi_chu: '',
        ton_kho_ban_dau: 0
    });

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchApi('/api/san-pham');
            setRecords(data || []);
        } catch (err) {
            toast('Lỗi tải danh sách sản phẩm: ' + err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Get unique values for filters
    const departments = useMemo(() => {
        const set = new Set(records.map(r => r.bo_phan).filter(Boolean));
        return Array.from(set).sort();
    }, [records]);

    const vehicleTypes = useMemo(() => {
        const set = new Set();
        records.forEach(r => {
            if (!r.loai_xe) return;
            // Handle multiple vehicle types separated by comma
            r.loai_xe.split(',').forEach(v => {
                const trimmed = v.trim();
                if (trimmed) set.add(trimmed);
            });
        });
        return Array.from(set).sort();
    }, [records]);

    const filteredRecords = useMemo(() => {
        let list = records;

        if (filterBoPhan) {
            list = list.filter(r => r.bo_phan === filterBoPhan);
        }

        if (filterLoaiXe) {
            list = list.filter(r => r.loai_xe && r.loai_xe.toLowerCase().includes(filterLoaiXe.toLowerCase()));
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(r =>
                (r.ten_sp || '').toLowerCase().includes(term) ||
                (r.ma_sp || '').toLowerCase().includes(term) ||
                (r.nguoi_phu_trach || '').toLowerCase().includes(term) ||
                (r.loai_xe || '').toLowerCase().includes(term) ||
                (r.ghi_chu || '').toLowerCase().includes(term)
            );
        }

        return list;
    }, [records, searchTerm, filterBoPhan, filterLoaiXe]);

    const handleOpenAddModal = () => {
        setIsEditMode(false);
        setFormData({
            ma_sp: '',
            ten_sp: '',
            loai_xe: '',
            bo_phan: '',
            nguoi_phu_trach: '',
            ghi_chu: '',
            ton_kho_ban_dau: 0
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (item) => {
        setIsEditMode(true);
        setCurrentId(item.id);
        setFormData({
            ma_sp: item.ma_sp,
            ten_sp: item.ten_sp,
            loai_xe: item.loai_xe,
            bo_phan: item.bo_phan,
            nguoi_phu_trach: item.nguoi_phu_trach,
            ghi_chu: item.ghi_chu,
            ton_kho_ban_dau: item.ton_kho_ban_dau
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await fetchApi(`/api/san-pham/${currentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                toast('Cập nhật sản phẩm thành công');
            } else {
                await fetchApi('/api/san-pham', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                toast('Thêm sản phẩm mới thành công');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;
        try {
            await fetchApi(`/api/san-pham/${id}`, { method: 'DELETE' });
            toast('Đã xóa sản phẩm thành công');
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (!hasPermission('san-pham')) {
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
                    <h2>Danh sách Sản Phẩm (Chi Tiết)</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Danh mục chi tiết sản phẩm, bộ phận phụ trách và tồn kho thành phẩm</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={16} /> Thêm sản phẩm mới
                    </button>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="card" style={{ padding: 20 }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Filter Bo Phan */}
                        <select className="form-select" style={{ width: 180 }}
                            value={filterBoPhan} onChange={e => setFilterBoPhan(e.target.value)}>
                            <option value="">-- Bộ phận (Tất cả) --</option>
                            {departments.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        {/* Filter Loai Xe */}
                        <select className="form-select" style={{ width: 180 }}
                            value={filterLoaiXe} onChange={e => setFilterLoaiXe(e.target.value)}>
                            <option value="">-- Loại xe (Tất cả) --</option>
                            {vehicleTypes.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
                            Hiển thị: {filteredRecords.length} sản phẩm
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: 32, width: 250 }}
                                placeholder="Tìm kiếm sản phẩm, người phụ trách..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="table-wrapper" style={{ height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                    <table className="table" style={{ fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>#</th>
                                <th style={{ width: '30%' }}>Mã SP</th>
                                <th style={{ width: '50%' }}>Tên sản phẩm (Chi tiết)</th>
                                <th style={{ width: '100px' }}>Loại xe</th>
                                <th style={{ width: '150px' }}>Bộ phận sản xuất</th>
                                <th style={{ width: '100px' }}>Người phụ trách</th>
                                <th style={{ textAlign: 'right', width: '90px' }}>Tồn ban đầu</th>
                                <th style={{ textAlign: 'right', width: '90px' }}>Tồn hiện tại</th>
                                <th>Ghi chú</th>
                                <th style={{ textAlign: 'center', width: 90 }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu...</td></tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Không tìm thấy sản phẩm nào</td></tr>
                            ) : filteredRecords.map((r, i) => (
                                <tr key={r.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                    <td>{r.ma_sp}</td>
                                    <td>{r.ten_sp}</td>
                                    <td>
                                        {r.loai_xe || '-'}
                                    </td>
                                    <td>{r.bo_phan || '-'}</td>
                                    <td>{r.nguoi_phu_trach || '-'}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{r.ton_kho_ban_dau}</td>
                                    <td style={{
                                        textAlign: 'right',
                                        color: '#059669'
                                    }}>
                                        {r.ton_kho_hien_tai}
                                    </td>
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
                            ))}
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
                                {isEditMode ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Mã sản phẩm (Bỏ trống để tạo tự động)</label>
                                    <input
                                        className="form-input"
                                        placeholder="Ví dụ: SP-001"
                                        value={formData.ma_sp}
                                        onChange={e => setFormData({ ...formData, ma_sp: e.target.value })}
                                        disabled={isEditMode}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tên sản phẩm</label>
                                    <input
                                        className="form-input"
                                        placeholder="Nhập tên sản phẩm..."
                                        value={formData.ten_sp}
                                        onChange={e => setFormData({ ...formData, ten_sp: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Loại xe</label>
                                    <input
                                        className="form-input"
                                        placeholder="Ví dụ: KN, KG, UN hoặc KN, GL..."
                                        value={formData.loai_xe}
                                        onChange={e => setFormData({ ...formData, loai_xe: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bộ phận sản xuất</label>
                                    <input
                                        className="form-input"
                                        placeholder="Ví dụ: HÚT NỘI THẤT, CHẤM NHỰA..."
                                        value={formData.bo_phan}
                                        onChange={e => setFormData({ ...formData, bo_phan: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Người phụ trách sản xuất</label>
                                    <input
                                        className="form-input"
                                        placeholder="Ví dụ: MAL, CHINH, A HÙNG..."
                                        value={formData.nguoi_phu_trach}
                                        onChange={e => setFormData({ ...formData, nguoi_phu_trach: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tồn kho ban đầu</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        placeholder="0"
                                        value={formData.ton_kho_ban_dau}
                                        onChange={e => setFormData({ ...formData, ton_kho_ban_dau: parseFloat(e.target.value || 0) })}
                                        disabled={isEditMode}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ghi chú</label>
                                <textarea
                                    className="form-input"
                                    placeholder="Ghi chú thêm..."
                                    rows={2}
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
