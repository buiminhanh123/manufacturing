'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { Search, Plus, Minus, X, ArrowUpRight, ArrowDownLeft, Eye, Trash2, Download, Upload, Package, Truck } from 'lucide-react';

function AutocompleteSelect({ options, value, onChange, placeholder }) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const inputRef = useRef(null);

    const selectedOpt = options.find(o => o.id === parseInt(value));

    useEffect(() => {
        if (selectedOpt) {
            setSearch(selectedOpt.label);
        } else {
            setSearch('');
        }
    }, [value, selectedOpt]);

    const filtered = useMemo(() => {
        if (!search || (selectedOpt && search === selectedOpt.label)) return options;
        const s = search.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(s));
    }, [options, search, selectedOpt]);

    const updateCoords = () => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                ref={inputRef}
                type="text"
                className="form-input"
                style={{ padding: '6px 10px', height: '32px' }}
                placeholder={placeholder}
                value={search}
                onChange={e => {
                    setSearch(e.target.value);
                    setIsOpen(true);
                    updateCoords();
                    if (!e.target.value) {
                        onChange('');
                    }
                }}
                onFocus={() => {
                    setIsOpen(true);
                    updateCoords();
                }}
                onBlur={() => {
                    setTimeout(() => {
                        setIsOpen(false);
                        if (selectedOpt) {
                            setSearch(selectedOpt.label);
                        } else {
                            setSearch('');
                        }
                    }, 200);
                }}
            />
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    top: coords.top,
                    left: coords.left,
                    width: coords.width,
                    background: 'white',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 99999,
                    maxHeight: 180,
                    overflowY: 'auto',
                    padding: 4
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                            Không tìm thấy kết quả
                        </div>
                    ) : (
                        filtered.map(opt => (
                            <div
                                key={opt.id}
                                onMouseDown={() => {
                                    onChange(opt.id);
                                    setSearch(opt.label);
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    borderBottom: '1px solid #f3f4f6',
                                    textAlign: 'left'
                                }}
                                onMouseEnter={e => e.target.style.background = '#f3f4f6'}
                                onMouseLeave={e => e.target.style.background = 'white'}
                            >
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                                {opt.info && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.info}</div>}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default function SpTransactionsPage() {
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' or 'details'

    // Data lists
    const [tickets, setTickets] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [toasts, setToasts] = useState([]);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);

    // Form data for creating ticket
    const [ticketForm, setTicketForm] = useState({
        type: 'IN_SP', // 'IN_SP' or 'OUT_SP'
        date: new Date().toISOString().split('T')[0],
        notes: '',
        items: [{ sp_id: '', quantity: '', notes: '' }]
    });

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [ticketData, txData, spData] = await Promise.all([
                fetchApi('/api/phieu?type_prefix=SP'),
                fetchApi('/api/san-pham/transactions/all'),
                fetchApi('/api/san-pham')
            ]);
            setTickets(ticketData || []);
            setTransactions(txData || []);
            setProducts(spData || []);
        } catch (err) {
            toast('Lỗi tải dữ liệu kho: ' + err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (hasPermission('sp-transactions')) {
            loadData();
        }
    }, []);

    // Autocomplete select options for products
    const productOptions = useMemo(() => {
        return products.map(p => ({
            id: p.id,
            label: `${p.ma_sp} - ${p.ten_sp}`,
            info: `Loại xe: ${p.loai_xe || 'N/A'} | Bộ phận: ${p.bo_phan || 'N/A'} | Tồn kho: ${p.ton_kho_hien_tai}`
        }));
    }, [products]);

    // Filter tickets
    const filteredTickets = useMemo(() => {
        let list = tickets;
        if (filterType) {
            const fullType = filterType === 'IN' ? 'IN_SP' : 'OUT_SP';
            list = list.filter(t => t.type === fullType);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(t =>
                (t.ma_phieu || '').toLowerCase().includes(term) ||
                (t.notes || '').toLowerCase().includes(term) ||
                (t.creator_name || '').toLowerCase().includes(term)
            );
        }
        return list;
    }, [tickets, searchTerm, filterType]);

    // Filter detailed transactions
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

    // Modal Actions
    const handleOpenAddModal = (type) => {
        setTicketForm({
            type, // 'IN_SP' or 'OUT_SP'
            date: new Date().toISOString().split('T')[0],
            notes: '',
            items: [{ sp_id: '', quantity: '', notes: '' }]
        });
        setShowAddModal(true);
    };

    const handleAddItem = () => {
        setTicketForm(prev => ({
            ...prev,
            items: [...prev.items, { sp_id: '', quantity: '', notes: '' }]
        }));
    };

    const handleRemoveItem = (index) => {
        setTicketForm(prev => {
            const updated = [...prev.items];
            updated.splice(index, 1);
            return { ...prev, items: updated };
        });
    };

    const handleItemChange = (index, field, value) => {
        setTicketForm(prev => {
            const updated = [...prev.items];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, items: updated };
        });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            // Validate items
            if (ticketForm.items.some(item => !item.sp_id || !item.quantity)) {
                throw new Error('Vui lòng chọn sản phẩm và số lượng cho tất cả các dòng');
            }

            // Check stock if OUT
            if (ticketForm.type === 'OUT_SP') {
                for (const item of ticketForm.items) {
                    const prod = products.find(p => p.id === parseInt(item.sp_id));
                    const qty = parseFloat(item.quantity);
                    if (prod && prod.ton_kho_hien_tai < qty) {
                        throw new Error(`Sản phẩm '${prod.ten_sp}' không đủ tồn kho. Tồn hiện tại: ${prod.ton_kho_hien_tai}`);
                    }
                }
            }

            await fetchApi('/api/phieu', {
                method: 'POST',
                body: JSON.stringify(ticketForm)
            });

            toast('Ghi nhận phiếu kho thành phẩm thành công');
            setShowAddModal(false);
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    const handleViewDetails = async (id) => {
        try {
            const data = await fetchApi(`/api/phieu/${id}`);
            setSelectedTicket(data);
            setShowViewModal(true);
        } catch (err) {
            toast('Lỗi tải chi tiết phiếu: ' + err.message, 'error');
        }
    };

    const handleDeleteTicket = async (id, code) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa phiếu kho '${code}' không? Toàn bộ số lượng thành phẩm trong phiếu sẽ được hoàn lại (revert) vào tồn kho.`)) {
            return;
        }

        try {
            await fetchApi(`/api/phieu/${id}`, { method: 'DELETE' });
            toast('Đã xóa phiếu kho và cập nhật lại tồn kho sản phẩm');
            loadData();
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    if (!hasPermission('sp-transactions')) {
        return (
            <div className="page-content">
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                    Từ chối truy cập. Bạn không có quyền xem giao dịch Sản phẩm.
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
                    <h2>Quản lý Nhập / Xuất Kho Thành Phẩm</h2>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={() => handleOpenAddModal('IN_SP')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10b981', borderColor: '#10b981' }}>
                        <ArrowDownLeft size={16} /> Tạo phiếu nhập thành phẩm
                    </button>
                    <button className="btn btn-primary" onClick={() => handleOpenAddModal('OUT_SP')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ef4444', borderColor: '#ef4444' }}>
                        <ArrowUpRight size={16} /> Tạo phiếu xuất thành phẩm
                    </button>
                </div>
            </div>

            {/* Stats Cards Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {/* Card 1: Tổng phiếu nhập */}
                <div style={{
                    background: '#10b981',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0
                    }}>
                        <Download size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>Tổng phiếu nhập</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                            {tickets.filter(t => t.type === 'IN_SP').length} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>phiếu</span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Tổng phiếu xuất */}
                <div style={{
                    background: '#ef4444',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0
                    }}>
                        <Upload size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>Tổng phiếu xuất</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                            {tickets.filter(t => t.type === 'OUT_SP').length} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>phiếu</span>
                        </div>
                    </div>
                </div>

                {/* Card 3: Tổng lượng nhập */}
                <div style={{
                    background: '#3b82f6',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0
                    }}>
                        <Package size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>Tổng lượng nhập</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                            {transactions.filter(t => t.type === 'IN').reduce((acc, curr) => acc + parseFloat(curr.quantity || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>sản phẩm</span>
                        </div>
                    </div>
                </div>

                {/* Card 4: Tổng lượng xuất */}
                <div style={{
                    background: '#f59e0b',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0
                    }}>
                        <Truck size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>Tổng lượng xuất</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                            {transactions.filter(t => t.type === 'OUT').reduce((acc, curr) => acc + parseFloat(curr.quantity || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>sản phẩm</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20, gap: 16 }}>
                <button
                    style={{
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'tickets' ? '2px solid var(--accent)' : '2px solid transparent',
                        color: activeTab === 'tickets' ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                    onClick={() => setActiveTab('tickets')}
                >
                    Danh sách Phiếu Kho
                </button>
                <button
                    style={{
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'details' ? '2px solid var(--accent)' : '2px solid transparent',
                        color: activeTab === 'details' ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                    onClick={() => setActiveTab('details')}
                >
                    Lịch sử chi tiết (Giao dịch lẻ)
                </button>
            </div>

            {/* Main Content Card */}
            <div className="card" style={{ padding: 20 }}>
                {/* Search & Filter Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select className="form-select" style={{ width: 180 }}
                            value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="">-- Tất cả loại phiếu --</option>
                            <option value="IN">Nhập kho (IN)</option>
                            <option value="OUT">Xuất kho (OUT)</option>
                        </select>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            Hiển thị: {activeTab === 'tickets' ? filteredTickets.length : filteredTransactions.length} kết quả
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: 32, width: 280 }}
                                placeholder={activeTab === 'tickets' ? "Tìm theo mã phiếu, ghi chú..." : "Tìm theo mã phiếu, sản phẩm, ghi chú..."}
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Tab 1: List of Tickets */}
                {activeTab === 'tickets' && (
                    <div className="table-wrapper" style={{ height: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: '13px', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '5%' }}>#</th>
                                    <th style={{ width: '20%', whiteSpace: 'nowrap' }}>Mã phiếu</th>
                                    <th style={{ textAlign: 'center', width: '15%', whiteSpace: 'nowrap' }}>Loại phiếu</th>
                                    <th style={{ width: '15%', whiteSpace: 'nowrap' }}>Ngày lập</th>
                                    <th style={{ width: '15%', whiteSpace: 'nowrap' }}>Người lập</th>
                                    <th style={{ width: '20%' }}>Ghi chú phiếu</th>
                                    <th style={{ textAlign: 'center', width: '10%', whiteSpace: 'nowrap' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu phiếu kho...</td></tr>
                                ) : filteredTickets.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Không tìm thấy phiếu kho nào</td></tr>
                                ) : filteredTickets.map((t, idx) => (
                                    <tr key={t.id}>
                                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                                        <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{t.ma_phieu}</td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {t.type === 'IN_SP' ? (
                                                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                                                    <ArrowDownLeft size={12} /> Nhập kho
                                                </span>
                                            ) : (
                                                <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                                    <ArrowUpRight size={12} /> Xuất kho
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{t.creator_name || 'Hệ thống'}</td>
                                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.notes || '-'}</td>
                                        <td>
                                            <div className="actions" style={{ justifyContent: 'center' }}>
                                                <button className="btn btn-secondary btn-icon" title="Xem chi tiết" onClick={() => handleViewDetails(t.id)}>
                                                    <Eye size={14} />
                                                </button>
                                                <button className="btn btn-secondary btn-icon" style={{ color: 'var(--danger)' }} title="Xóa phiếu" onClick={() => handleDeleteTicket(t.id, t.ma_phieu)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 2: Detailed Raw History */}
                {activeTab === 'details' && (
                    <div className="table-wrapper" style={{ height: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                        <table className="table" style={{ fontSize: '13px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th style={{ width: 140, whiteSpace: 'nowrap' }}>Chứng từ</th>
                                    <th style={{ textAlign: 'center', width: 80, whiteSpace: 'nowrap' }}>Loại</th>
                                    <th style={{ width: 90, whiteSpace: 'nowrap' }}>Ngày</th>
                                    <th style={{ width: 80, whiteSpace: 'nowrap' }}>Mã SP</th>
                                    <th>Tên sản phẩm</th>
                                    <th style={{ width: 130, whiteSpace: 'nowrap' }}>Bộ phận phụ trách</th>
                                    <th style={{ textAlign: 'right', width: 90, whiteSpace: 'nowrap' }}>Số lượng</th>
                                    <th>Ghi chú giao dịch</th>
                                    <th style={{ width: 100, whiteSpace: 'nowrap' }}>Người lập</th>
                                    <th style={{ textAlign: 'center', width: 80, whiteSpace: 'nowrap' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu lịch sử...</td></tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Không tìm thấy lịch sử nhập xuất lẻ</td></tr>
                                ) : filteredTransactions.map((t, i) => (
                                    <tr key={t.id}>
                                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                        <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{t.reference || '-'}</td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {t.type === 'IN' ? (
                                                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <ArrowDownLeft size={12} /> Nhập
                                                </span>
                                            ) : (
                                                <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <ArrowUpRight size={12} /> Xuất
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{t.ma_sp}</td>
                                        <td>{t.ten_sp}</td>
                                        <td>{t.bo_phan || '-'}</td>
                                        <td style={{
                                            textAlign: 'right',
                                            color: t.type === 'IN' ? '#059669' : '#dc2626',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {t.type === 'IN' ? '+' : '-'}{t.quantity}
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.notes || '-'}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.creator_name || 'Hệ thống'}</td>
                                        <td>
                                            <div className="actions" style={{ justifyContent: 'center' }}>
                                                {t.phieu_id ? (
                                                    <button className="btn btn-secondary btn-icon" title="Xem phiếu cha" onClick={() => handleViewDetails(t.phieu_id)}>
                                                        <Eye size={14} />
                                                    </button>
                                                ) : (
                                                    '-'
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

            {/* Modal 1: Create Ticket (Scale 80vw/95vh with strict flex layouts) */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '80vw', height: '95vh', maxWidth: 'none', display: 'flex', flexDirection: 'column', padding: 24, overflow: 'hidden' }}>
                        <div className="modal-header" style={{ flexShrink: 0 }}>
                            <h3 className="modal-title">
                                {ticketForm.type === 'IN_SP' ? (
                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ArrowDownLeft size={22} /> Lập Phiếu Nhập Kho Thành Phẩm
                                    </span>
                                ) : (
                                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ArrowUpRight size={22} /> Lập Phiếu Xuất Kho Thành Phẩm
                                    </span>
                                )}
                            </h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleCreateSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', paddingRight: 4 }}>
                                {/* Row 1: Loại phiếu, Thời gian */}
                                <div className="form-row" style={{ flexShrink: 0 }}>
                                    <div className="form-group">
                                        <label className="form-label">Loại phiếu</label>
                                        <input className="form-input" readOnly style={{ background: '#f3f4f6', fontWeight: 600 }}
                                            value={ticketForm.type === 'IN_SP' ? 'NHẬP KHO (IN)' : 'XUẤT KHO (OUT)'} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ngày lập *</label>
                                        <input className="form-input" type="date" required
                                            value={ticketForm.date} onChange={e => setTicketForm(prev => ({ ...prev, date: e.target.value }))} />
                                    </div>
                                </div>

                                {/* Row 2: Danh sách sản phẩm (Fixed Container with scrolling inside) */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                    <h4 style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                        <span>Danh sách sản phẩm nhập xuất</span>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 'unset', padding: '4px 10px', fontSize: 12 }}>
                                            <Plus size={14} /> Thêm dòng
                                        </button>
                                    </h4>

                                    <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                        <table className="table" style={{ minWidth: 600, border: 'none' }}>
                                            <thead>
                                                <tr>
                                                    <th>Sản phẩm * (Gõ để tìm kiếm)</th>
                                                    <th style={{ width: 140 }}>Số lượng *</th>
                                                    <th>Ghi chú dòng</th>
                                                    <th style={{ width: 50, textAlign: 'center' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ticketForm.items.map((item, index) => {
                                                    const prod = products.find(p => p.id === parseInt(item.sp_id));
                                                    return (
                                                        <tr key={index}>
                                                            <td style={{ verticalAlign: 'top', padding: '6px 8px' }}>
                                                                <AutocompleteSelect
                                                                    options={productOptions}
                                                                    value={item.sp_id}
                                                                    onChange={val => handleItemChange(index, 'sp_id', val)}
                                                                    placeholder="Tìm mã hoặc tên sản phẩm..."
                                                                />
                                                                {prod && (
                                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingBottom: 2 }}>
                                                                        Hiện có: <strong style={{ color: 'var(--accent)' }}>{prod.ton_kho_hien_tai}</strong> sản phẩm
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={{ verticalAlign: 'top', padding: '6px 8px' }}>
                                                                <input className="form-input" type="number" step="any" min="0.001" placeholder="0.0"
                                                                    style={{ padding: '6px 10px', height: '32px' }}
                                                                    value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} required />
                                                            </td>
                                                            <td style={{ verticalAlign: 'top', padding: '6px 8px' }}>
                                                                <input className="form-input" placeholder="Ghi chú chi tiết dòng..."
                                                                    style={{ padding: '6px 10px', height: '32px' }}
                                                                    value={item.notes} onChange={e => handleItemChange(index, 'notes', e.target.value)} />
                                                            </td>
                                                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '6px 8px' }}>
                                                                <button type="button" className="btn btn-secondary btn-icon" style={{ color: 'var(--danger)', height: 32, width: 32 }}
                                                                    onClick={() => handleRemoveItem(index)} disabled={ticketForm.items.length === 1}>
                                                                    <X size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Row 3: Ghi chú ở bên dưới */}
                                <div className="form-group" style={{ flexShrink: 0, marginTop: 4 }}>
                                    <label className="form-label">Ghi chú phiếu</label>
                                    <textarea className="form-input" placeholder="Lý do nhập/xuất thành phẩm, ghi chú bán hàng..." rows={2}
                                        value={ticketForm.notes} onChange={e => setTicketForm(prev => ({ ...prev, notes: e.target.value }))} />
                                </div>
                            </div>

                            <div className="modal-footer" style={{ flexShrink: 0, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                                <button className="btn btn-secondary" type="button" onClick={() => setShowAddModal(false)}>Hủy bỏ</button>
                                <button className="btn btn-primary" type="submit"
                                    style={{ background: ticketForm.type === 'IN_SP' ? '#10b981' : '#ef4444', borderColor: ticketForm.type === 'IN_SP' ? '#10b981' : '#ef4444' }}>
                                    Xác nhận lập phiếu
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: View Ticket Details */}
            {showViewModal && selectedTicket && (
                <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '80vw', height: '95vh', maxWidth: 'none', display: 'flex', flexDirection: 'column', padding: 24, overflow: 'hidden' }}>
                        <div className="modal-header" style={{ flexShrink: 0 }}>
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                Chi tiết Phiếu Kho: <span style={{ color: 'var(--accent)' }}>{selectedTicket.ma_phieu}</span>
                            </h3>
                            <button className="modal-close" onClick={() => setShowViewModal(false)}><X size={20} /></button>
                        </div>

                        <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', paddingRight: 4 }}>
                            {/* Row 1: Loại phiếu, Thời gian */}
                            <div className="form-row" style={{ flexShrink: 0 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Loại phiếu</label>
                                    <div style={{ marginTop: 8 }}>
                                        {selectedTicket.type === 'IN_SP' ? (
                                            <span className="badge badge-success">Nhập kho</span>
                                        ) : (
                                            <span className="badge badge-danger">Xuất kho</span>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Ngày lập</label>
                                    <input className="form-input" readOnly style={{ background: '#f3f4f6' }} value={selectedTicket.date} />
                                </div>
                            </div>

                            {/* Row 2: Danh sách SP */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <h4 style={{ marginBottom: 10, flexShrink: 0 }}>Danh sách sản phẩm</h4>
                                <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                    <table className="table" style={{ border: 'none' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 50 }}>#</th>
                                                <th>Mã SP</th>
                                                <th>Tên sản phẩm</th>
                                                <th>Loại xe</th>
                                                <th>Bộ phận</th>
                                                <th style={{ textAlign: 'right', width: 140 }}>Số lượng</th>
                                                <th>Ghi chú dòng</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedTicket.items.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                                                    <td style={{ fontWeight: 700 }}>{item.ma_sp}</td>
                                                    <td>{item.ten_sp}</td>
                                                    <td>{item.loai_xe || '-'}</td>
                                                    <td>{item.bo_phan || '-'}</td>
                                                    <td style={{
                                                        textAlign: 'right',
                                                        fontWeight: 700,
                                                        color: selectedTicket.type === 'IN_SP' ? '#059669' : '#dc2626'
                                                    }}>
                                                        {selectedTicket.type === 'IN_SP' ? '+' : '-'}{item.quantity}
                                                    </td>
                                                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Row 3: Ghi chú ở bên dưới */}
                            <div className="form-group" style={{ flexShrink: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Ghi chú phiếu</label>
                                <textarea className="form-input" readOnly style={{ background: '#f3f4f6' }} rows={2} value={selectedTicket.notes || ''} />
                            </div>

                            <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                                Người lập: <strong>{selectedTicket.creator_name || 'Hệ thống'}</strong>
                            </div>
                        </div>

                        <div className="modal-footer" style={{ flexShrink: 0, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                            <button className="btn btn-secondary" type="button" onClick={() => setShowViewModal(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
