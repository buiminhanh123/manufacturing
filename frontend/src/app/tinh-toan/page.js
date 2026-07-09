'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { 
    Plus, 
    Trash2, 
    Edit, 
    X, 
    FileText, 
    CheckCircle, 
    Search, 
    Calendar, 
    Eye, 
    AlertTriangle, 
    Printer, 
    ClipboardList,
    AlertCircle
} from 'lucide-react';

export default function TinhToanPage() {
    const { user, hasPermission } = useAuth();
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [toasts, setToasts] = useState([]);

    // Modal control states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [printType, setPrintType] = useState('plan'); // 'plan' (Kế hoạch) hoặc 'outward' (Phiếu xuất kho)

    // Form data for creating/editing order
    const [orderForm, setOrderForm] = useState({
        id: null,
        ma_lenh: '',
        ten_lenh: '',
        ngay_bat_dau: new Date().toISOString().split('T')[0],
        ngay_ket_thuc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        items: [{ sp_id: '', ma_sp_input: '', ten_sp_input: '', quantity: '', showMaSuggestions: false, showTenSuggestions: false }]
    });

    // Real-time calculations inside Create popup
    const [liveCalculations, setLiveCalculations] = useState([]);
    const [calculatingLive, setCalculatingLive] = useState(false);

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
    };

    const loadProducts = async () => {
        try {
            const data = await fetchApi('/api/san-pham');
            setProducts(data || []);
        } catch (err) {
            toast('Lỗi tải danh mục sản phẩm: ' + err.message, 'error');
        }
    };

    const loadOrders = async () => {
        setLoadingOrders(true);
        try {
            const data = await fetchApi('/api/dinh-muc/lenh-san-xuat');
            setOrders(data || []);
        } catch (err) {
            toast('Lỗi tải danh sách lệnh sản xuất: ' + err.message, 'error');
        }
        setLoadingOrders(false);
    };

    useEffect(() => {
        loadProducts();
        loadOrders();
    }, []);

    // Real-time calculation effect
    useEffect(() => {
        const validItems = orderForm.items
            .map(it => ({ sp_id: parseInt(it.sp_id), quantity: parseFloat(it.quantity) }))
            .filter(it => !isNaN(it.sp_id) && !isNaN(it.quantity) && it.quantity > 0);

        if (validItems.length === 0) {
            setLiveCalculations([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setCalculatingLive(true);
            try {
                const res = await fetchApi('/api/dinh-muc/tinh-toan', {
                    method: 'POST',
                    body: JSON.stringify({ productionItems: validItems })
                });
                setLiveCalculations(res || []);
            } catch (err) {
                console.error('Error calculating live BOM:', err);
            }
            setCalculatingLive(false);
        }, 350); // Debounce to allow user to finish typing

        return () => clearTimeout(delayDebounceFn);
    }, [orderForm.items]);

    // Filter orders by search query
    const filteredOrders = orders.filter(o => {
        if (!searchQuery) return true;
        const term = searchQuery.toLowerCase();
        return (o.ma_lenh || '').toLowerCase().includes(term) ||
               (o.ten_lenh || '').toLowerCase().includes(term) ||
               (o.notes || '').toLowerCase().includes(term) ||
               (o.creator || '').toLowerCase().includes(term);
    });

    // Create Modal handlers
    const handleOpenCreateModal = () => {
        setOrderForm({
            id: null,
            ma_lenh: '',
            ten_lenh: '',
            ngay_bat_dau: new Date().toISOString().split('T')[0],
            ngay_ket_thuc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: '',
            items: [{ sp_id: '', ma_sp_input: '', ten_sp_input: '', quantity: '', showMaSuggestions: false, showTenSuggestions: false }]
        });
        setLiveCalculations([]);
        setShowCreateModal(true);
    };

    const handleOpenEditModal = (orderItem) => {
        setLoadingDetail(true);
        fetchApi(`/api/dinh-muc/lenh-san-xuat/${orderItem.id}`)
            .then(data => {
                setOrderForm({
                    id: data.order.id,
                    ma_lenh: data.order.ma_lenh || '',
                    ten_lenh: data.order.ten_lenh || '',
                    ngay_bat_dau: data.order.ngay_bat_dau || data.order.date || '',
                    ngay_ket_thuc: data.order.ngay_ket_thuc || '',
                    notes: data.order.notes || '',
                    items: data.items.map(it => {
                        const prod = products.find(p => p.id === it.sp_id);
                        return {
                            sp_id: it.sp_id.toString(),
                            ma_sp_input: prod ? prod.ma_sp : '',
                            ten_sp_input: prod ? prod.ten_sp : '',
                            quantity: it.quantity.toString(),
                            showMaSuggestions: false,
                            showTenSuggestions: false
                        };
                    })
                });
                setShowDetailModal(false);
                setShowCreateModal(true);
            })
            .catch(err => toast('Lỗi tải thông tin lệnh: ' + err.message, 'error'))
            .finally(() => setLoadingDetail(false));
    };

    const handleFormItemChange = (index, field, value) => {
        const newItems = [...orderForm.items];
        newItems[index][field] = value;
        setOrderForm({ ...orderForm, items: newItems });
    };

    const handleSpInputChange = (index, field, value) => {
        const newItems = [...orderForm.items];
        newItems[index][field] = value;
        
        // If they clear the input, clear relationship values
        if (!value.trim()) {
            newItems[index].sp_id = '';
            if (field === 'ma_sp_input') {
                newItems[index].ten_sp_input = '';
            } else {
                newItems[index].ma_sp_input = '';
            }
        }
        
        setOrderForm({ ...orderForm, items: newItems });
    };

    const handleFocusSuggestions = (index, field) => {
        const newItems = [...orderForm.items];
        if (field === 'ma_sp') {
            newItems[index].showMaSuggestions = true;
        } else {
            newItems[index].showTenSuggestions = true;
        }
        setOrderForm({ ...orderForm, items: newItems });
    };

    const handleBlurSuggestions = (index, field) => {
        const newItems = [...orderForm.items];
        if (field === 'ma_sp') {
            newItems[index].showMaSuggestions = false;
        } else {
            newItems[index].showTenSuggestions = false;
        }
        setOrderForm({ ...orderForm, items: newItems });
    };

    const handleSelectProduct = (index, product) => {
        const newItems = [...orderForm.items];
        newItems[index].sp_id = product.id.toString();
        newItems[index].ma_sp_input = product.ma_sp;
        newItems[index].ten_sp_input = product.ten_sp;
        newItems[index].showMaSuggestions = false;
        newItems[index].showTenSuggestions = false;
        setOrderForm({ ...orderForm, items: newItems });
    };

    const handleAddFormItem = () => {
        setOrderForm({
            ...orderForm,
            items: [...orderForm.items, { sp_id: '', ma_sp_input: '', ten_sp_input: '', quantity: '', showMaSuggestions: false, showTenSuggestions: false }]
        });
    };

    const handleRemoveFormItem = (index) => {
        if (orderForm.items.length === 1) {
            toast('Lệnh sản xuất phải chứa ít nhất một sản phẩm', 'error');
            return;
        }
        const newItems = orderForm.items.filter((_, idx) => idx !== index);
        setOrderForm({ ...orderForm, items: newItems });
    };

    const handleSubmitOrder = async (e) => {
        e.preventDefault();
        
        // Validation
        const validItems = orderForm.items
            .map(it => ({ sp_id: parseInt(it.sp_id), quantity: parseFloat(it.quantity) }))
            .filter(it => !isNaN(it.sp_id) && !isNaN(it.quantity) && it.quantity > 0);

        if (validItems.length === 0) {
            toast('Vui lòng chọn sản phẩm và nhập số lượng hợp lệ', 'error');
            return;
        }

        setLoadingAction(true);
        try {
            const url = orderForm.id ? `/api/dinh-muc/lenh-san-xuat/${orderForm.id}` : '/api/dinh-muc/lenh-san-xuat';
            const method = orderForm.id ? 'PUT' : 'POST';

            await fetchApi(url, {
                method,
                body: JSON.stringify({
                    ma_lenh: orderForm.ma_lenh,
                    ten_lenh: orderForm.ten_lenh,
                    ngay_bat_dau: orderForm.ngay_bat_dau,
                    ngay_ket_thuc: orderForm.ngay_ket_thuc,
                    date: orderForm.ngay_bat_dau,
                    notes: orderForm.notes,
                    items: validItems
                })
            });

            toast(orderForm.id ? 'Cập nhật lệnh sản xuất thành công' : 'Tạo lệnh sản xuất thành công');
            setShowCreateModal(false);
            loadOrders();
        } catch (err) {
            toast(err.message, 'error');
        }
        setLoadingAction(false);
    };

    // Detail Modal handlers
    const handleViewDetails = async (orderId) => {
        setLoadingDetail(true);
        setSelectedOrderDetails(null);
        try {
            const data = await fetchApi(`/api/dinh-muc/lenh-san-xuat/${orderId}`);
            setSelectedOrderDetails(data);
            setShowDetailModal(true);
        } catch (err) {
            toast('Lỗi tải chi tiết lệnh sản xuất: ' + err.message, 'error');
        }
        setLoadingDetail(false);
    };

    const handleDeleteOrder = async (orderId) => {
        if (!confirm('Bạn có chắc chắn muốn xóa lệnh sản xuất này không?')) return;
        setLoadingAction(true);
        try {
            await fetchApi(`/api/dinh-muc/lenh-san-xuat/${orderId}`, { method: 'DELETE' });
            toast('Đã xóa lệnh sản xuất thành công');
            setShowDetailModal(false);
            loadOrders();
        } catch (err) {
            toast(err.message, 'error');
        }
        setLoadingAction(false);
    };

    const handleIssueStock = async (orderId, bypassShortage = false) => {
        setLoadingAction(true);
        try {
            const response = await fetchApi(`/api/dinh-muc/lenh-san-xuat/${orderId}/cap-phat`, {
                method: 'POST',
                body: JSON.stringify({ bypassShortage })
            });
            toast(response.message || 'Cấp phát và xuất kho thành công!');
            
            // Reload order details
            const data = await fetchApi(`/api/dinh-muc/lenh-san-xuat/${orderId}`);
            setSelectedOrderDetails(data);
            loadOrders();
        } catch (err) {
            if (err.shortageCode === 'INSUFFICIENT_STOCK') {
                if (confirm(`${err.message}\n\nBạn có muốn tiếp tục ép buộc xuất kho (trừ kho âm) không?`)) {
                    handleIssueStock(orderId, true);
                    return;
                }
            } else {
                toast(err.message, 'error');
            }
        }
        setLoadingAction(false);
    };

    const triggerPrint = (type) => {
        setPrintType(type);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    if (!hasPermission('tinh-toan')) {
        return (
            <div className="page-content">
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                    Quyền truy cập bị từ chối
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

            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Lập & Quản Lý Lệnh Sản Xuất</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
                        Theo dõi danh sách lệnh sản xuất, tính toán nhu cầu nguyên vật liệu và in biểu mẫu (Kế hoạch / Xuất kho)
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleOpenCreateModal} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, flexShrink: 0 }}>
                    <Plus size={16} /> Tạo Lệnh Sản Xuất
                </button>
            </div>

            {/* Search filter bar */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
                    <input 
                        className="form-input" 
                        style={{ paddingLeft: 36, width: '100%' }}
                        placeholder="Tìm kiếm lệnh sản xuất theo mã, tên lệnh..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)} 
                    />
                </div>
            </div>

            {/* List of Orders Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loadingOrders ? (
                    <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải danh sách lệnh...</p>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                        <p style={{ fontSize: 14 }}>Chưa có lệnh sản xuất nào được lập phù hợp</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '190px' }}>Mã Lệnh</th>
                                    <th>Tên Lệnh Sản Xuất</th>
                                    <th style={{ width: '220px' }}>Thời Gian Yêu Cầu</th>
                                    <th style={{ width: '150px' }}>Người Lập</th>
                                    <th style={{ width: '160px', textAlign: 'center' }}>Trạng Thái</th>
                                    <th style={{ width: '120px', textAlign: 'center' }}>Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map(order => (
                                    <tr key={order.id}>
                                        <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{order.ma_lenh}</td>
                                        <td style={{ fontWeight: 600 }}>{order.ten_lenh || '-'}</td>
                                        <td style={{ fontSize: 12 }}>
                                            {order.ngay_bat_dau ? `${new Date(order.ngay_bat_dau).toLocaleDateString('vi-VN')} → ${new Date(order.ngay_ket_thuc).toLocaleDateString('vi-VN')}` : '-'}
                                        </td>
                                        <td>{order.creator || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${order.status === 'Đã cấp phát' ? 'badge-success' : 'badge-warning'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="actions" style={{ justifyContent: 'center', gap: 6 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewDetails(order.id)} style={{ padding: '4px 8px' }} title="Xem chi tiết & in">
                                                    <Eye size={14} />
                                                </button>
                                                {order.status !== 'Đã cấp phát' && (
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(order)} style={{ padding: '4px 8px' }} title="Sửa">
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* POPUP 1: Expanded 90% Width and Height Create / Edit Order Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ 
                        width: '90%', 
                        height: '90%', 
                        maxWidth: 'none', 
                        maxHeight: 'none', 
                        display: 'flex', 
                        flexDirection: 'column',
                        padding: '20px',
                        overflow: 'hidden'
                    }}>
                        <div className="modal-header" style={{ flexShrink: 0, paddingBottom: 0, marginBottom: 10 }}>
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {orderForm.id ? <Edit size={22} color="var(--accent)" /> : <Plus size={22} color="var(--accent)" />}
                                {orderForm.id ? `Chỉnh sửa Lệnh: ${orderForm.ma_lenh}` : 'Lập Lệnh Sản Xuất Mới'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                            {/* Metadata input grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr', gap: 12, marginBottom: 10, flexShrink: 0 }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Mã lệnh sản xuất</label>
                                    <input className="form-input" placeholder="Hệ thống tự tạo nếu trống..." value={orderForm.ma_lenh}
                                        onChange={e => setOrderForm({ ...orderForm, ma_lenh: e.target.value })} disabled={orderForm.id !== null} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Tên lệnh sản xuất</label>
                                    <input className="form-input" placeholder="Ví dụ: Lệnh SX đệm lót KN..." value={orderForm.ten_lenh}
                                        onChange={e => setOrderForm({ ...orderForm, ten_lenh: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Ngày bắt đầu</label>
                                    <input className="form-input" type="date" value={orderForm.ngay_bat_dau}
                                        onChange={e => setOrderForm({ ...orderForm, ngay_bat_dau: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">Ngày kết thúc</label>
                                    <input className="form-input" type="date" value={orderForm.ngay_ket_thuc}
                                        onChange={e => setOrderForm({ ...orderForm, ngay_ket_thuc: e.target.value })} required />
                                </div>
                            </div>

                            {/* Side by side workspace */}
                            <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0, marginBottom: 10 }}>
                                {/* Left Panel: Product Input Table */}
                                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '32px', marginBottom: 10, flexShrink: 0 }}>
                                        <strong style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Danh sách sản phẩm chế tạo</strong>
                                        <button className="btn btn-secondary btn-sm" type="button" onClick={handleAddFormItem} style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                            <Plus size={14} /> Thêm sản phẩm
                                        </button>
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px 12px 180px 12px', background: '#f8fafc' }}>
                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr 1.2fr auto', gap: 12, padding: '12px 8px 8px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', height: '36px', alignItems: 'center', position: 'sticky', top: '-12px', zIndex: 10, background: '#f8fafc', marginTop: '-12px' }}>
                                            <div>MÃ SẢN PHẨM</div>
                                            <div>TÊN SẢN PHẨM</div>
                                            <div>SL SẢN XUẤT</div>
                                            <div style={{ width: 32 }}></div>
                                        </div>
                                        
                                        {orderForm.items.map((item, idx) => (
                                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr 1.2fr auto', gap: 12, alignItems: 'center', height: '46px', marginBottom: 8, padding: '0 8px', background: '#fff', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                                                {/* Autocomplete Input Mã SP */}
                                                <div style={{ position: 'relative' }}>
                                                    <input 
                                                        className="form-input form-input-sm" 
                                                        value={item.ma_sp_input || ''} 
                                                        onChange={e => handleSpInputChange(idx, 'ma_sp_input', e.target.value)} 
                                                        placeholder="Tìm mã SP..."
                                                        onFocus={() => handleFocusSuggestions(idx, 'ma_sp')}
                                                        onBlur={() => setTimeout(() => handleBlurSuggestions(idx, 'ma_sp'), 250)}
                                                        required
                                                    />
                                                    {item.showMaSuggestions && (
                                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '380px', zIndex: 1000, backgroundColor: '#fff', border: '1px solid var(--border-color)', maxHeight: 180, overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                                            {products.filter(p => p.ma_sp.toLowerCase().includes((item.ma_sp_input || '').toLowerCase())).map(p => (
                                                                <li 
                                                                    key={p.id} 
                                                                    onClick={() => handleSelectProduct(idx, p)} 
                                                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f0f0f0' }}
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                >
                                                                    <strong>{p.ma_sp}</strong> - {p.ten_sp}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>

                                                {/* Autocomplete Input Tên SP */}
                                                <div style={{ position: 'relative' }}>
                                                    <input 
                                                        className="form-input form-input-sm" 
                                                        value={item.ten_sp_input || ''} 
                                                        onChange={e => handleSpInputChange(idx, 'ten_sp_input', e.target.value)} 
                                                        placeholder="Tìm tên sản phẩm..."
                                                        onFocus={() => handleFocusSuggestions(idx, 'ten_sp')}
                                                        onBlur={() => setTimeout(() => handleBlurSuggestions(idx, 'ten_sp'), 250)}
                                                        required
                                                    />
                                                    {item.showTenSuggestions && (
                                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '480px', zIndex: 1000, backgroundColor: '#fff', border: '1px solid var(--border-color)', maxHeight: 180, overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                                            {products.filter(p => p.ten_sp.toLowerCase().includes((item.ten_sp_input || '').toLowerCase())).map(p => (
                                                                <li 
                                                                    key={p.id} 
                                                                    onClick={() => handleSelectProduct(idx, p)} 
                                                                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f0f0f0' }}
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                >
                                                                    {p.ten_sp} (<strong>{p.ma_sp}</strong>)
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>

                                                {/* Quantity Input */}
                                                <div>
                                                    <input 
                                                        className="form-input form-input-sm" 
                                                        type="number" 
                                                        min="0.001" 
                                                        step="any" 
                                                        placeholder="SL cần..." 
                                                        value={item.quantity}
                                                        onChange={e => handleFormItemChange(idx, 'quantity', e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                {/* Delete Row */}
                                                <div>
                                                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => handleRemoveFormItem(idx)} style={{ color: 'var(--danger)', borderColor: 'var(--border-color)', padding: '6px 8px' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Panel: Live Calculations & Stock Check */}
                                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', minWidth: 0, borderLeft: '1px solid var(--border-color)', paddingLeft: 24, height: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '32px', marginBottom: 10, flexShrink: 0 }}>
                                        <strong style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Dự toán NVL &amp; Trạng thái kho</strong>
                                        {liveCalculations.length > 0 && (
                                            liveCalculations.some(r => r.shortage > 0) ? (
                                                <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                                    <AlertTriangle size={12} /> Kho thiếu vật tư
                                                </span>
                                            ) : (
                                                <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                                    <CheckCircle size={12} /> Kho đáp ứng đủ
                                                </span>
                                            )
                                        )}
                                    </div>
                                    
                                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px 12px 180px 12px', background: '#f8fafc' }}>
                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr', gap: 12, padding: '12px 8px 8px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', height: '36px', alignItems: 'center', position: 'sticky', top: '-12px', zIndex: 10, background: '#f8fafc', marginTop: '-12px' }}>
                                            <div>MÃ NVL</div>
                                            <div>TÊN NVL</div>
                                            <div style={{ textAlign: 'right' }}>CẦN DÙNG</div>
                                            <div style={{ textAlign: 'right' }}>TỒN KHO</div>
                                            <div style={{ textAlign: 'right' }}>THIẾU</div>
                                        </div>

                                        {calculatingLive ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-muted)', fontSize: 12 }}>
                                                Đang tính toán...
                                            </div>
                                        ) : liveCalculations.length === 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: '0 20px' }}>
                                                Vui lòng chọn sản phẩm và điền số lượng để xem tính toán vật tư và kiểm tra tồn kho trực tiếp.
                                            </div>
                                        ) : (
                                            liveCalculations.map(res => (
                                                <div key={res.nvl_id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', height: '46px', marginBottom: 8, padding: '0 8px', background: '#fff', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 11 }}>
                                                    <div style={{ fontWeight: 700 }}>{res.ma_nvl}</div>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={res.ten_nvl}>
                                                        {res.ten_nvl}
                                                    </div>
                                                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{res.required_quantity} {res.dvt}</div>
                                                    <div style={{ textAlign: 'right' }}>{res.ton_kho_hien_tai}</div>
                                                    <div style={{ 
                                                        textAlign: 'right', 
                                                        fontWeight: 700, 
                                                        color: res.shortage > 0 ? 'var(--danger)' : 'var(--success)' 
                                                    }}>
                                                        {res.shortage > 0 ? res.shortage : 'Đủ'}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Note Area */}
                            <div className="form-group" style={{ marginBottom: 10, flexShrink: 0 }}>
                                <label className="form-label">Ghi chú liên quan đến lệnh sản xuất</label>
                                <textarea 
                                    className="form-input" 
                                    placeholder="Nhập các ghi chú bổ sung..." 
                                    value={orderForm.notes}
                                    onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}
                                    style={{ height: '56px', resize: 'none' }}
                                />
                            </div>

                            <div className="modal-footer" style={{ flexShrink: 0, paddingTop: 10, marginTop: 10 }}>
                                <button className="btn btn-secondary" type="button" onClick={() => setShowCreateModal(false)}>Hủy</button>
                                <button className="btn btn-primary" type="submit" disabled={loadingAction}>
                                    {loadingAction ? 'Đang lưu...' : 'Lưu lệnh sản xuất'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* POPUP 2: View Detail, Issue Stock & PDF Exports Modal */}
            {showDetailModal && selectedOrderDetails && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{
                        width: '90vw',
                        maxWidth: '90vw',
                        height: '90vh',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {/* Fixed Header */}
                        <div className="modal-header" style={{ flexShrink: 0 }}>
                            <div>
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ClipboardList size={22} color="var(--accent)" />
                                    Lệnh Sản Xuất: {selectedOrderDetails.order.ma_lenh}
                                </h3>
                                <span className={`badge ${selectedOrderDetails.order.status === 'Đã cấp phát' ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: 6 }}>
                                    {selectedOrderDetails.order.status}
                                </span>
                            </div>
                            <button className="modal-close" onClick={() => setShowDetailModal(false)}><X size={20} /></button>
                        </div>

                        {/* Scrollable Body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
                            {/* Metadata row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, fontSize: 13, flexShrink: 0 }}>
                                <div><strong>Mã lệnh:</strong> {selectedOrderDetails.order.ma_lenh}</div>
                                <div><strong>Tên lệnh:</strong> {selectedOrderDetails.order.ten_lenh || '-'}</div>
                                <div><strong>Thời gian thực hiện:</strong> {selectedOrderDetails.order.ngay_bat_dau ? `${new Date(selectedOrderDetails.order.ngay_bat_dau).toLocaleDateString('vi-VN')} → ${new Date(selectedOrderDetails.order.ngay_ket_thuc).toLocaleDateString('vi-VN')}` : '-'}</div>
                                <div><strong>Người lập:</strong> {selectedOrderDetails.order.creator || 'Hệ thống'}</div>
                                {selectedOrderDetails.order.notes && (
                                    <div style={{ gridColumn: 'span 2' }}><strong>Ghi chú:</strong> {selectedOrderDetails.order.notes}</div>
                                )}
                            </div>

                            {/* Side-by-side layout for the two tables */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
                                {/* Section 1: Target Products */}
                                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '32px', marginBottom: 10, flexShrink: 0 }}>
                                        <strong style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>1. Danh sách sản phẩm sản xuất</strong>
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px 12px 12px 12px', background: '#f8fafc', minHeight: 0 }}>
                                        {/* Header row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '0.4fr 1fr 2.5fr 1fr 1fr', gap: 12, padding: '12px 8px 8px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', height: '36px', alignItems: 'center', position: 'sticky', top: '-12px', zIndex: 10, background: '#f8fafc', marginTop: '-12px' }}>
                                            <div>#</div>
                                            <div>MÃ SP</div>
                                            <div>TÊN SẢN PHẨM</div>
                                            <div>LOẠI XE</div>
                                            <div style={{ textAlign: 'right' }}>SL SX</div>
                                        </div>
                                        {selectedOrderDetails.items.length === 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', color: 'var(--text-muted)', fontSize: 12 }}>
                                                Không có sản phẩm nào
                                            </div>
                                        ) : (
                                            selectedOrderDetails.items.map((it, idx) => (
                                                <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '0.4fr 1fr 2.5fr 1fr 1fr', gap: 12, alignItems: 'center', height: '46px', marginBottom: 8, padding: '0 8px', background: '#fff', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 11 }}>
                                                    <div style={{ color: 'var(--text-muted)' }}>{idx + 1}</div>
                                                    <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{it.ma_sp}</div>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={it.ten_sp}>{it.ten_sp}</div>
                                                    <div style={{ color: 'var(--text-secondary)' }}>{it.loai_xe || '-'}</div>
                                                    <div style={{ textAlign: 'right', fontWeight: 700 }}>{it.quantity}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Section 2: Calculated BOM Requirements */}
                                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: '1px solid var(--border-color)', paddingLeft: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '32px', marginBottom: 10, flexShrink: 0 }}>
                                        <strong style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>2. Nhu cầu cấp phát NVL (BOM)</strong>
                                        {selectedOrderDetails.order.status !== 'Đã cấp phát' && (
                                            selectedOrderDetails.bomResults.some(r => r.shortage > 0) ? (
                                                <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                                    <AlertTriangle size={12} /> Kho thiếu vật tư
                                                </span>
                                            ) : (
                                                <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                                    <CheckCircle size={12} /> Kho đáp ứng đủ
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px 12px 12px 12px', background: '#f8fafc', minHeight: 0 }}>
                                        {/* Header row */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr', gap: 12, padding: '12px 8px 8px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', height: '36px', alignItems: 'center', position: 'sticky', top: '-12px', zIndex: 10, background: '#f8fafc', marginTop: '-12px' }}>
                                            <div>MÃ NVL</div>
                                            <div>TÊN NVL</div>
                                            <div style={{ textAlign: 'right' }}>CẦN DÙNG</div>
                                            <div style={{ textAlign: 'right' }}>TỒN KHO</div>
                                            <div style={{ textAlign: 'right' }}>THIẾU</div>
                                        </div>
                                        {selectedOrderDetails.bomResults.length === 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: '0 20px' }}>
                                                Sản phẩm chọn chưa được cấu hình định mức nguyên vật liệu
                                            </div>
                                        ) : (
                                            selectedOrderDetails.bomResults.map(res => (
                                                <div key={res.nvl_id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', height: '46px', marginBottom: 8, padding: '0 8px', background: '#fff', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 11 }}>
                                                    <div style={{ fontWeight: 700 }}>{res.ma_nvl}</div>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={res.ten_nvl}>
                                                        {res.ten_nvl}
                                                        {res.quy_cach && <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)' }}>{res.quy_cach}</span>}
                                                    </div>
                                                    <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>{res.required_quantity} {res.dvt}</div>
                                                    <div style={{ textAlign: 'right' }}>{res.ton_kho_hien_tai}</div>
                                                    <div style={{ textAlign: 'right', fontWeight: 700, color: res.shortage > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                        {res.shortage > 0 ? res.shortage : 'Đủ'}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fixed Footer */}
                        <div className="modal-footer" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary" onClick={() => triggerPrint('plan')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Printer size={16} /> Xuất KH sản xuất
                                </button>
                                <button className="btn btn-secondary" onClick={() => triggerPrint('outward')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Printer size={16} /> Xuất phiếu xuất kho
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                {selectedOrderDetails.order.status !== 'Đã cấp phát' && (
                                    <>
                                        <button className="btn btn-secondary" onClick={() => handleOpenEditModal(selectedOrderDetails.order)}>Sửa</button>
                                        <button className="btn btn-danger" onClick={() => handleDeleteOrder(selectedOrderDetails.order.id)} disabled={loadingAction}>Xóa</button>
                                        <button className="btn btn-primary" onClick={() => handleIssueStock(selectedOrderDetails.order.id)} disabled={loadingAction} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle size={16} /> Cấp phát &amp; Xuất kho
                                        </button>
                                    </>
                                )}
                                <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Đóng</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT LAYOUT: PDF Document Render (Hidden by default on screen, targets @media print) */}
            {selectedOrderDetails && (
                <div id="production-order-print" style={{ display: 'none' }}>
                    <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
                        {/* Header block */}
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
                                {printType === 'plan' ? 'KẾ HOẠCH SẢN XUẤT CHI TIẾT' : 'PHIẾU XUẤT KHO NGUYÊN VẬT LIỆU CHẾ TẠO'}
                            </h2>
                            <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>
                                Mã Lệnh: {selectedOrderDetails.order.ma_lenh} | Ngày Lập: {new Date(selectedOrderDetails.order.date).toLocaleDateString('vi-VN')}
                            </p>
                        </div>

                        {/* General Info */}
                        <table style={{ width: '100%', marginBottom: '20px', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '4px 0', width: '55%' }}><strong>Mã Lệnh:</strong> {selectedOrderDetails.order.ma_lenh}</td>
                                    <td style={{ padding: '4px 0', width: '45%' }}><strong>Tên Lệnh:</strong> {selectedOrderDetails.order.ten_lenh || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '4px 0' }}><strong>Thời gian thực hiện:</strong> {selectedOrderDetails.order.ngay_bat_dau ? `${new Date(selectedOrderDetails.order.ngay_bat_dau).toLocaleDateString('vi-VN')} → ${new Date(selectedOrderDetails.order.ngay_ket_thuc).toLocaleDateString('vi-VN')}` : '-'}</td>
                                    <td style={{ padding: '4px 0' }}><strong>Trạng thái lệnh:</strong> {selectedOrderDetails.order.status}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '4px 0' }}><strong>Người lập lệnh:</strong> {selectedOrderDetails.order.creator || '-'}</td>
                                    <td style={{ padding: '4px 0' }}><strong>Đơn vị chế tạo:</strong> Nhà xưởng chế tạo Anh Trung</td>
                                </tr>
                                {selectedOrderDetails.order.notes && (
                                    <tr>
                                        <td colSpan={2} style={{ padding: '4px 0' }}><strong>Ghi chú:</strong> {selectedOrderDetails.order.notes}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* PLAN VIEW: Render only the target products table */}
                        {printType === 'plan' && (
                            <>
                                <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', margin: '16px 0 8px 0', fontSize: '14px', textTransform: 'uppercase' }}>
                                    Danh sách sản phẩm sản xuất
                                </h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '40px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f2f2f2' }}>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '40px' }}>STT</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', width: '130px' }}>Mã Sản Phẩm</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Tên Sản Phẩm</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', width: '120px' }}>Loại xe</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', width: '120px' }}>Bộ phận</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', width: '100px' }}>Số Lượng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrderDetails.items.map((it, idx) => (
                                            <tr key={it.id}>
                                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                                                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{it.ma_sp}</td>
                                                <td style={{ border: '1px solid #000', padding: '8px' }}>{it.ten_sp}</td>
                                                <td style={{ border: '1px solid #000', padding: '8px' }}>{it.loai_xe}</td>
                                                <td style={{ border: '1px solid #000', padding: '8px' }}>{it.bo_phan || '-'}</td>
                                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{it.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}

                        {/* OUTWARD VIEW: Render only the raw materials requirements table */}
                        {printType === 'outward' && (
                            <>
                                <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', margin: '16px 0 8px 0', fontSize: '14px', textTransform: 'uppercase' }}>
                                    Phiếu yêu cầu xuất kho nguyên vật liệu
                                </h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '40px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f2f2f2' }}>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '40px' }}>STT</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', width: '110px' }}>Mã NVL</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Tên Vật Tư / Quy cách</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', width: '130px' }}>Số Lượng Cần Xuất</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '80px' }}>ĐVT</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Ký Nhận</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrderDetails.bomResults.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ border: '1px solid #000', textAlign: 'center', padding: '20px' }}>
                                                    Sản phẩm trong lệnh chưa có định mức nguyên vật liệu
                                                </td>
                                            </tr>
                                        ) : (
                                            selectedOrderDetails.bomResults.map((res, idx) => (
                                                <tr key={res.nvl_id}>
                                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                                                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{res.ma_nvl}</td>
                                                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                                                        <div>{res.ten_nvl}</div>
                                                        {res.quy_cach && <div style={{ fontSize: '10px', color: '#666' }}>Quy cách: {res.quy_cach}</div>}
                                                    </td>
                                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                                        {res.required_quantity}
                                                    </td>
                                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{res.dvt}</td>
                                                    <td style={{ border: '1px solid #000', padding: '8px', color: '#ccc' }}>..................</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </>
                        )}

                        {/* Signatures */}
                        <table style={{ width: '100%', marginTop: '50px', fontSize: '13px', borderCollapse: 'collapse', textAlign: 'center' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '33%', paddingBottom: '80px' }}><strong>Người Yêu Cầu</strong><br/><span style={{ fontSize: '11px', color: '#666' }}>(Ký, ghi rõ họ tên)</span></td>
                                    <td style={{ width: '33%', paddingBottom: '80px' }}><strong>Thủ Kho Xuất</strong><br/><span style={{ fontSize: '11px', color: '#666' }}>(Ký, ghi rõ họ tên)</span></td>
                                    <td style={{ width: '33%', paddingBottom: '80px' }}><strong>Duyệt Nhập / Giám Đốc</strong><br/><span style={{ fontSize: '11px', color: '#666' }}>(Ký, ghi rõ họ tên)</span></td>
                                </tr>
                                <tr>
                                    <td><strong>{selectedOrderDetails.order.creator || user?.display_name || '-'}</strong></td>
                                    <td>................................</td>
                                    <td>................................</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
