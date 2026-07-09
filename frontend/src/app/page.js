'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchApi } from '@/lib/api';
import { 
    Package, 
    AlertTriangle, 
    RefreshCw, 
    CheckCircle, 
    TrendingUp, 
    TrendingDown,
    ArrowRight
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, Legend 
} from 'recharts';

export default function Dashboard() {
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [nvls, setNvls] = useState([]);
    const [products, setProducts] = useState([]);
    const [nvlTx, setNvlTx] = useState([]);
    const [toasts, setToasts] = useState([]);

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [nvlData, prodData, txData] = await Promise.all([
                fetchApi('/api/nvl'),
                fetchApi('/api/san-pham'),
                fetchApi('/api/nvl/transactions/all')
            ]);
            setNvls(nvlData);
            setProducts(prodData);
            setNvlTx(txData);
        } catch (err) {
            toast('Lỗi tải dữ liệu tổng quan: ' + err.message, 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    // 1. Calculate KPI values
    const totalNvl = nvls.length;
    const totalProd = products.length;
    
    // Warning items: current stock < minimum inventory
    const lowStockNvls = useMemo(() => {
        return nvls.filter(n => n.ton_kho_hien_tai < n.min_inventory);
    }, [nvls]);

    const warningCount = lowStockNvls.length;

    // Total transactions in the last 30 days
    const recentTxCount = nvlTx.length;

    // 2. Prepare chart data: Group transactions by date (last 7 days)
    const chartData = useMemo(() => {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            last7Days.push({ date: dateStr, name: date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' }), 'Nhập kho': 0, 'Xuất kho': 0 });
        }

        nvlTx.forEach(tx => {
            const dayObj = last7Days.find(d => d.date === tx.date);
            if (dayObj) {
                if (tx.type === 'IN') {
                    dayObj['Nhập kho'] += tx.quantity;
                } else if (tx.type === 'OUT') {
                    dayObj['Xuất kho'] += tx.quantity;
                }
            }
        });

        // Round values
        return last7Days.map(d => ({
            ...d,
            'Nhập kho': parseFloat(d['Nhập kho'].toFixed(2)),
            'Xuất kho': parseFloat(d['Xuất kho'].toFixed(2))
        }));
    }, [nvlTx]);

    if (!hasPermission('dashboard')) {
        return (
            <div className="page-content">
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                    Từ chối quyền truy cập. Bạn không có quyền xem trang này.
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
                    <h2>Tổng Quan Hệ Thống</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                        Báo cáo tồn kho sản phẩm, nguyên vật liệu và kế hoạch sản xuất
                    </p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 48, height: 48, border: '4px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Đang tải dữ liệu tổng quan...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* KPI Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                        {/* NVL Count */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    background: 'var(--gradient-info)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)'
                                }}>
                                    <Package size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Nguyên Vật Liệu
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                                        {totalNvl} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>mặt hàng</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Product Count */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    background: 'var(--gradient-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)'
                                }}>
                                    <CheckCircle size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Danh mục Sản Phẩm
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                                        {totalProd} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>chi tiết</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Low Stock Warning */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    background: warningCount > 0 ? 'var(--gradient-danger)' : 'var(--gradient-success)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: warningCount > 0 ? '0 4px 12px rgba(239, 68, 68, 0.25)' : '0 4px 12px rgba(16, 185, 129, 0.25)'
                                }}>
                                    <AlertTriangle size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Cảnh báo tồn kho NVL
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: warningCount > 0 ? 'var(--danger)' : 'var(--success)', marginTop: 2 }}>
                                        {warningCount} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>sắp hết</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Transaction Count */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    background: 'var(--gradient-warning)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                                }}>
                                    <RefreshCw size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Giao dịch phát sinh
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                                        {recentTxCount} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>lịch sử</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart + Warning List Layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
                        {/* Transaction Chart */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                                <TrendingUp size={18} color="var(--accent)" />
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Lượng Nhập Xuất NVL (7 ngày qua)</h3>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{
                                            background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="Nhập kho" fill="url(#barIn)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    <Bar dataKey="Xuất kho" fill="url(#barOut)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    <defs>
                                        <linearGradient id="barIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                                        </linearGradient>
                                        <linearGradient id="barOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Inventory Warnings */}
                        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                                <AlertTriangle size={18} color="var(--danger)" />
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Vật Tư Cần Nhập Thêm ({warningCount})</h3>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 280 }} className="table-wrapper">
                                <table className="table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Mã NVL</th>
                                            <th>Tên vật tư</th>
                                            <th style={{ textAlign: 'right' }}>Tồn kho</th>
                                            <th style={{ textAlign: 'right' }}>Định mức an toàn</th>
                                            <th style={{ textAlign: 'center' }}>ĐVT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lowStockNvls.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                                                    Tất cả nguyên vật liệu đều ở mức an toàn
                                                </td>
                                            </tr>
                                        ) : (
                                            lowStockNvls.map(n => (
                                                <tr key={n.id}>
                                                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{n.ma_nvl}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 500 }}>{n.ten_nvl}</div>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.quy_cach}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                                                        {n.ton_kho_hien_tai}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                                        {n.min_inventory}
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: 12 }}>
                                                        <span className="badge badge-warning">{n.dvt}</span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
