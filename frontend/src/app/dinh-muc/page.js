'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { Search, Plus, Trash2, Edit, X, Save, FileSpreadsheet, AlertCircle } from 'lucide-react';

export default function DinhMucPage() {
    const { hasPermission } = useAuth();
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingBom, setLoadingBom] = useState(false);
    const [products, setProducts] = useState([]);
    const [selectedSpId, setSelectedSpId] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [materialSearchText, setMaterialSearchText] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [toasts, setToasts] = useState([]);

    // Modal state for adding a BOM item
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        nvl_id: '',
        so_luong: '',
        ty_le_hao_hut: '0',
        ghi_chu: ''
    });

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadProducts = async () => {
        setLoadingProducts(true);
        try {
            const data = await fetchApi('/api/san-pham');
            setProducts(data || []);
            if (data && data.length > 0) {
                setSelectedSpId(prev => prev || data[0].id);
            }
        } catch (err) {
            toast('Lỗi tải sản phẩm: ' + err.message, 'error');
        }
        setLoadingProducts(false);
    };

    const loadMaterials = async () => {
        try {
            const data = await fetchApi('/api/nvl');
            setMaterials(data || []);
        } catch (err) {
            console.error('Error loading materials:', err);
        }
    };

    const loadBom = async (spId) => {
        if (!spId) return;
        setLoadingBom(true);
        try {
            const data = await fetchApi(`/api/dinh-muc/${spId}`);
            setBomItems(data || []);
        } catch (err) {
            toast('Lỗi tải định mức: ' + err.message, 'error');
        }
        setLoadingBom(false);
    };

    useEffect(() => {
        loadProducts();
        loadMaterials();
    }, []);

    useEffect(() => {
        if (selectedSpId) {
            loadBom(selectedSpId);
        }
    }, [selectedSpId]);

    const selectedProduct = useMemo(() => {
        return products.find(p => p.id === selectedSpId) || null;
    }, [selectedSpId, products]);

    const filteredProducts = useMemo(() => {
        let list = [...products];
        if (productSearch) {
            const term = productSearch.toLowerCase();
            list = list.filter(p =>
                (p.ten_sp || '').toLowerCase().includes(term) ||
                (p.ma_sp || '').toLowerCase().includes(term) ||
                (p.loai_xe || '').toLowerCase().includes(term)
            );
        }
        // Sort: products with bom_count === 0 (or undefined) first, then products with bom_count > 0
        return list.sort((a, b) => {
            const aHas = (a.bom_count || 0) > 0 ? 1 : 0;
            const bHas = (b.bom_count || 0) > 0 ? 1 : 0;
            return aHas - bHas;
        });
    }, [products, productSearch]);

    const filteredMaterials = useMemo(() => {
        if (!materialSearchText) return materials;
        // If the user has already selected a material and the search text matches its full description, don't filter it out
        const term = materialSearchText.toLowerCase();
        return materials.filter(m => 
            (m.ma_nvl || '').toLowerCase().includes(term) ||
            (m.ten_nvl || '').toLowerCase().includes(term)
        );
    }, [materials, materialSearchText]);

    const handleAddBomItem = () => {
        setFormData({
            nvl_id: '',
            so_luong: '',
            ty_le_hao_hut: '0',
            ghi_chu: ''
        });
        setMaterialSearchText('');
        setShowSuggestions(false);
        setIsEditing(false);
        setShowModal(true);
    };

    const handleEditBomItem = (item) => {
        setFormData({
            nvl_id: item.nvl_id.toString(),
            so_luong: item.so_luong.toString(),
            ty_le_hao_hut: item.ty_le_hao_hut.toString(),
            ghi_chu: item.ghi_chu || ''
        });
        setMaterialSearchText(`${item.ma_nvl} - ${item.ten_nvl} (${item.dvt})`);
        setShowSuggestions(false);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSubmitBom = async (e) => {
        e.preventDefault();
        try {
            if (!formData.nvl_id) {
                throw new Error('Vui lòng chọn một nguyên vật liệu từ danh sách gợi ý');
            }
            const qty = parseFloat(formData.so_luong);
            if (isNaN(qty) || qty <= 0) {
                throw new Error('Số lượng định mức phải là một số dương');
            }

            const lossRate = parseFloat(formData.ty_le_hao_hut);
            if (isNaN(lossRate) || lossRate < 0) {
                throw new Error('Tỷ lệ hao hụt phải là số không âm');
            }

            await fetchApi('/api/dinh-muc', {
                method: 'POST',
                body: JSON.stringify({
                    sp_id: selectedSpId,
                    nvl_id: parseInt(formData.nvl_id),
                    so_luong: qty,
                    ty_le_hao_hut: lossRate,
                    ghi_chu: formData.ghi_chu
                })
            });

            toast('Lưu định mức thành công');
            setShowModal(false);
            loadBom(selectedSpId);
            loadProducts();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleDeleteBomItem = async (bomId) => {
        if (!confirm('Bạn có chắc chắn muốn xóa vật tư này khỏi định mức của sản phẩm không?')) return;
        try {
            await fetchApi(`/api/dinh-muc/${bomId}`, { method: 'DELETE' });
            toast('Đã xóa định mức vật tư');
            loadBom(selectedSpId);
            loadProducts();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (!hasPermission('dinh-muc')) {
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
            <div className="page-header">
                <div>
                    <h2>Định Mức Nguyên Vật Liệu (BOM)</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Thiết lập công thức sản xuất, quy định lượng NVL cần thiết cho từng sản phẩm</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
                {/* Left Side: Products List */}
                <div className="card" style={{ padding: 16, height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                        <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                        <input className="form-input" style={{ paddingLeft: 32, width: '100%' }}
                            placeholder="Tìm kiếm sản phẩm..." value={productSearch}
                            onChange={e => setProductSearch(e.target.value)} />
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        {loadingProducts ? (
                            <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Đang tải sản phẩm...</p>
                        ) : filteredProducts.length === 0 ? (
                            <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Không có sản phẩm nào</p>
                        ) : (
                            filteredProducts.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedSpId(p.id)}
                                    style={{
                                        padding: '14px 14px 8px 14px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: selectedSpId === p.id ? 'rgba(249, 115, 22, 0.08)' : '',
                                        borderLeft: selectedSpId === p.id ? '4px solid var(--accent)' : '4px solid transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                    className="product-list-item"
                                >
                                    <div style={{ 
                                          fontWeight: 600, 
                                          fontSize: 13, 
                                          color: p.bom_count > 0 ? 'var(--text-primary)' : '#ef4444',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                     }} title={p.ten_sp}>{p.ten_sp}</div>
                                     <div style={{ 
                                          fontSize: 11, 
                                          color: 'var(--text-secondary)', 
                                          marginTop: 8, 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: 6 
                                     }}>
                                         <span>{p.ma_sp}</span>
                                         {p.loai_xe && <><span>|</span><span>{p.loai_xe}</span></>}
                                         {p.bo_phan && <><span>|</span><span>{p.bo_phan}</span></>}
                                     </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Side: BOM Details */}
                <div className="card" style={{ padding: 20, minHeight: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {selectedProduct ? (
                        <>
                            {/* Product Header */}
                            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{selectedProduct.ten_sp}</h3>
                                    <button className="btn btn-primary" onClick={handleAddBomItem} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Plus size={16} /> Thêm NVL định mức
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <strong>Mã sản phẩm:</strong> 
                                        <span className="badge badge-primary" style={{ margin: 0, padding: '2px 6px', fontSize: 11 }}>{selectedProduct.ma_sp}</span>
                                    </span>
                                    <span><strong>Bộ phận:</strong> {selectedProduct.bo_phan || '-'}</span>
                                    <span><strong>Người phụ trách:</strong> {selectedProduct.nguoi_phu_trach || '-'}</span>
                                </div>
                            </div>

                            {/* BOM Table */}
                            <div style={{ flex: 1, overflowY: 'auto' }} className="table-wrapper">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>#</th>
                                            <th style={{ width: 110, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>Mã NVL</th>
                                            <th style={{ minWidth: 200, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>Tên vật tư</th>
                                            <th style={{ width: 125, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>Quy cách</th>
                                            <th style={{ textAlign: 'right', width: 95, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>ĐM Chuẩn</th>
                                            <th style={{ textAlign: 'right', width: 85, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>Hao hụt</th>
                                            <th style={{ textAlign: 'right', width: 105, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>ĐM Thực tế</th>
                                            <th style={{ textAlign: 'center', width: 75, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>ĐVT</th>
                                            <th style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>Ghi chú</th>
                                            <th style={{ textAlign: 'center', width: 70, position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingBom ? (
                                            <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>Đang tải định mức...</td></tr>
                                        ) : bomItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                                        <FileSpreadsheet size={32} color="var(--text-muted)" />
                                                        <span>Chưa thiết lập định mức nguyên vật liệu cho sản phẩm này</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            bomItems.map((item, i) => {
                                                const lossRate = item.ty_le_hao_hut || 0;
                                                const actualQty = item.so_luong * (1 + lossRate / 100);

                                                return (
                                                    <tr key={item.id}>
                                                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                                        <td>{item.ma_nvl}</td>
                                                        <td>{item.ten_nvl}</td>
                                                        <td>{item.quy_cach || '-'}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                            {item.so_luong}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>
                                                            {lossRate}%
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                            {parseFloat(actualQty.toFixed(4))}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className="badge badge-secondary">{item.dvt}</span>
                                                        </td>
                                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.ghi_chu || '-'}</td>
                                                        <td>
                                                             <div className="actions" style={{ justifyContent: 'center', gap: 6 }}>
                                                                 <button className="btn btn-secondary btn-sm" onClick={() => handleEditBomItem(item)} style={{ padding: '4px 8px' }} title="Sửa">
                                                                     <Edit size={14} />
                                                                 </button>
                                                                 <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteBomItem(item.id)} style={{ padding: '4px 8px' }} title="Xóa">
                                                                     <Trash2 size={14} />
                                                                 </button>
                                                             </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: 14 }}>
                            Chọn một sản phẩm từ danh sách bên trái để thiết lập định mức
                        </div>
                    )}
                </div>
            </div>

            {/* Add BOM Item Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {isEditing ? <Edit size={20} style={{ marginRight: 8 }} /> : <Plus size={20} style={{ marginRight: 8 }} />}
                                {isEditing ? 'Cập nhật nguyên vật liệu định mức' : 'Thêm nguyên vật liệu vào định mức'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmitBom}>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label className="form-label">Chọn nguyên vật liệu</label>
                                <input 
                                    className="form-input" 
                                    placeholder="Tìm theo mã hoặc tên nguyên vật liệu..." 
                                    value={materialSearchText}
                                    onChange={e => {
                                        if (isEditing) return;
                                        setMaterialSearchText(e.target.value);
                                        setShowSuggestions(true);
                                        if (formData.nvl_id) {
                                            setFormData(prev => ({ ...prev, nvl_id: '' }));
                                        }
                                    }}
                                    onFocus={() => {
                                        if (!isEditing) setShowSuggestions(true);
                                    }}
                                    onBlur={() => {
                                        if (!isEditing) {
                                            setTimeout(() => {
                                                setShowSuggestions(false);
                                            }, 250);
                                        }
                                    }}
                                    disabled={isEditing}
                                    style={isEditing ? { background: '#f1f5f9', cursor: 'not-allowed', color: 'var(--text-secondary)' } : undefined}
                                    required
                                />
                                {!isEditing && showSuggestions && (
                                    <div style={{
                                        position: 'absolute',
                                        left: 0, right: 0,
                                        background: '#ffffff',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-sm)',
                                        boxShadow: 'var(--shadow-lg)',
                                        maxHeight: 180,
                                        overflowY: 'auto',
                                        zIndex: 1000,
                                        marginTop: 4
                                    }}>
                                        {filteredMaterials.length === 0 ? (
                                            <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                                                Không tìm thấy NVL nào
                                            </div>
                                        ) : (
                                            filteredMaterials.map(m => {
                                                const alreadyInBom = bomItems.some(item => item.nvl_id === m.id);
                                                return (
                                                    <div 
                                                        key={m.id}
                                                        onClick={() => {
                                                            if (alreadyInBom) return;
                                                            setFormData(prev => ({ ...prev, nvl_id: m.id.toString() }));
                                                            setMaterialSearchText(`${m.ma_nvl} - ${m.ten_nvl} (${m.dvt})`);
                                                            setShowSuggestions(false);
                                                        }}
                                                        onMouseEnter={e => {
                                                            if (!alreadyInBom) {
                                                                e.currentTarget.style.background = '#f1f5f9';
                                                            }
                                                        }}
                                                        onMouseLeave={e => {
                                                            if (!alreadyInBom) {
                                                                e.currentTarget.style.background = formData.nvl_id === m.id.toString() ? '#fff7ed' : '#ffffff';
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '8px 12px',
                                                            cursor: alreadyInBom ? 'not-allowed' : 'pointer',
                                                            background: formData.nvl_id === m.id.toString() ? '#fff7ed' : '#ffffff',
                                                            color: alreadyInBom ? 'var(--text-muted)' : 'var(--text-primary)',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            fontSize: 13,
                                                            transition: 'background 0.2s',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}
                                                    >
                                                        <span><strong>{m.ma_nvl}</strong> - {m.ten_nvl} ({m.dvt})</span>
                                                        {alreadyInBom && <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600 }}>Đã thiết lập</span>}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Số lượng định mức chuẩn (Tiêu hao lý thuyết trên 1 sản phẩm)</label>
                                <input className="form-input" type="number" step="any" min="0.0001" placeholder="Ví dụ: 0.1, 2.5"
                                    value={formData.so_luong} onChange={e => setFormData({ ...formData, so_luong: e.target.value })} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tỷ lệ hao hụt (%)</label>
                                <input className="form-input" type="number" step="any" min="0" max="100" placeholder="Ví dụ: 0, 5, 8"
                                    value={formData.ty_le_hao_hut} onChange={e => setFormData({ ...formData, ty_le_hao_hut: e.target.value })} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ghi chú định mức (Ví dụ: Thêm sáp, trộn màu...)</label>
                                <input className="form-input" placeholder="Ghi chú quy trình sản xuất..."
                                    value={formData.ghi_chu} onChange={e => setFormData({ ...formData, ghi_chu: e.target.value })} />
                            </div>

                            <div className="modal-footer">
                                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>Hủy</button>
                                <button className="btn btn-primary" type="submit">Lưu định mức</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
