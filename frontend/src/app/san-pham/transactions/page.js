'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { Search, Plus, X, RefreshCw, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function SpTransactionsPage() {
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [toasts, setToasts] = useState([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        sp_id: '',
        type: 'IN',
        quantity: '',
        date: new Date().toISOString().split('T')[0],
        reference: '',
        notes: ''
    });

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [txData, spData] = await Promise.all([
                fetchApi('/api/san-pham/transactions/all'),
                fetchApi('/api/san-pham')
            ]);
            setTransactions(txData || []);
            setProducts(spData || []);
        } catch (err) {
            toast('Lỗi tải lịch sử giao dịch: ' + err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const selectedProduct = useMemo(() => {
        if (!formData.sp_id) return null;
        return products.find(p => p.id === parseInt(formData.sp_id));
    }, [formData.sp_id, products]);

    const filteredTransactions = useMemo(() => {
        let list = transactions;

        if (filterType) {
            list = list.filter(t => t.type === filterType);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(t => 
                (t.ten_sp || '').toLowerCase().includes(term) ||
                (t.ma_sp || '').toLowerCase().includes(term) ||
                (t.reference || '').toLowerCase().includes(term) ||
                (t.notes || '').toLowerCase().includes(term)
            );
        }

        return list;
    }, [transactions, searchTerm, filterType]);

    const handleOpenAddModal = () => {
        setFormData({
            sp_id: '',
            type: 'IN',
            quantity: '',
            date: new Date().toISOString().split('T')[0],
            reference: '',
            notes: ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const qty = parseFloat(formData.quantity);
            if (isNaN(qty) || qty <= 0) {
                throw new Error('Số lượng phải là một số dương');
            }

            if (formData.type === 'OUT' && selectedProduct) {
                if (selectedProduct.ton_kho_hien_tai < qty) {
                    throw new Error(`Không đủ hàng xuất kho. Hiện có: ${selectedProduct.ton_kho_hien_tai} sản phẩm`);
                }
            }

            await fetchApi('/api/san-pham/transactions', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    sp_id: parseInt(formData.sp_id),
                    quantity: qty
                })
            });

            toast('Ghi nhận giao dịch sản phẩm thành công');
            setShowModal(false);
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (!hasPermission('sp-transactions')) {
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
                    <h2>Nhập / Xuất Kho Thành Phẩm</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Lịch sử nhập kho thành phẩm sau sản xuất và xuất kho bán hàng</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={16} /> Tạo phiếu Nhập / Xuất mới
                    </button>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="card" style={{ padding: 20 }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select className="form-select" style={{ width: 180 }}
                            value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="">-- Tất cả loại phiếu --</option>
                            <option value="IN">Nhập kho (IN)</option>
                            <option value="OUT">Xuất kho (OUT)</option>
                        </select>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filteredTransactions.length} giao dịch phát sinh</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: 32, width: 250 }}
                                placeholder="Tìm kiếm giao dịch, sản phẩm..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Table wrapper */}
                <div className="table-wrapper">
                    <table className="table">
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>#</th>
                                <th style={{ textAlign: 'center' }}>Loại phiếu</th>
                                <th>Ngày ghi nhận</th>
                                <th>Mã SP</th>
                                <th>Tên sản phẩm</th>
                                <th>Bộ phận phụ trách</th>
                                <th style={{ textAlign: 'right' }}>Số lượng</th>
                                <th>Mã chứng từ / Kế hoạch</th>
                                <th>Ghi chú</th>
                                <th>Người lập</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Không tìm thấy giao dịch nào</td></tr>
                            ) : filteredTransactions.map((t, i) => (
                                <tr key={t.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {t.type === 'IN' ? (
                                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <ArrowDownLeft size={12} /> Nhập kho
                                            </span>
                                        ) : (
                                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <ArrowUpRight size={12} /> Xuất bán
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{t.date}</td>
                                    <td style={{ fontWeight: 700 }}>{t.ma_sp}</td>
                                    <td style={{ fontWeight: 500 }}>{t.ten_sp}</td>
                                    <td>{t.bo_phan || '-'}</td>
                                    <td style={{ 
                                        textAlign: 'right', 
                                        fontWeight: 700, 
                                        color: t.type === 'IN' ? '#059669' : '#dc2626' 
                                    }}>
                                        {t.type === 'IN' ? '+' : '-'}{t.quantity}
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.reference || '-'}</td>
                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.notes || '-'}</td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.creator_name || 'Hệ thống'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Nhập/Xuất */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                <RefreshCw size={20} style={{ marginRight: 8 }} />
                                Phiếu Nhập / Xuất thành phẩm
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Chọn loại giao dịch</label>
                                <div style={{ display: 'flex', gap: 20 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        <input type="radio" name="sp_tx_type" checked={formData.type === 'IN'}
                                            onChange={() => setFormData({ ...formData, type: 'IN' })} />
                                        <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: 13 }}>NHẬP THÀNH PHẨM (+)</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        <input type="radio" name="sp_tx_type" checked={formData.type === 'OUT'}
                                            onChange={() => setFormData({ ...formData, type: 'OUT' })} />
                                        <span className="badge badge-danger" style={{ padding: '6px 12px', fontSize: 13 }}>XUẤT KHO BÁN (-)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Chọn sản phẩm</label>
                                <select className="form-select" value={formData.sp_id}
                                    onChange={e => setFormData({ ...formData, sp_id: e.target.value })} required>
                                    <option value="">-- Chọn sản phẩm --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.ma_sp} - {p.ten_sp} ({p.bo_phan ? `${p.bo_phan}, ` : ''}Tồn: {p.ton_kho_hien_tai})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedProduct && (
                                <div style={{ 
                                    background: 'var(--bg-primary)', 
                                    padding: '12px 16px', 
                                    borderRadius: 'var(--radius-md)', 
                                    marginBottom: 16,
                                    fontSize: 13,
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <div><strong>Người phụ trách:</strong> {selectedProduct.nguoi_phu_trach || '-'}</div>
                                    <div><strong>Tồn hiện tại:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>{selectedProduct.ton_kho_hien_tai}</span></div>
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Số lượng</label>
                                    <input className="form-input" type="number" step="any" min="0.001" placeholder="0"
                                        value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ngày ghi nhận</label>
                                    <input className="form-input" type="date"
                                        value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Mã chứng từ / Kế hoạch (Nếu có)</label>
                                <input className="form-input" placeholder="Ví dụ: LXS-001, DH-2026-X"
                                    value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ghi chú</label>
                                <textarea className="form-input" placeholder="Thông tin bổ sung..." rows={2}
                                    value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>Hủy</button>
                                <button className="btn btn-primary" type="submit">Ghi nhận phiếu</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
