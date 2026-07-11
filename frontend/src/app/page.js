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
    ArrowRight,
    ClipboardList,
    Layers,
    FileText
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

export default function Dashboard() {
    const { hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [nvls, setNvls] = useState([]);
    const [products, setProducts] = useState([]);
    const [nvlTx, setNvlTx] = useState([]);
    const [spTx, setSpTx] = useState([]);
    const [prodOrders, setProdOrders] = useState([]);
    const [toasts, setToasts] = useState([]);
    
    // Time filter state: 'this-week' | 'this-month' | 'last-30-days' | 'last-6-months' | 'this-year' | 'custom'
    const [timeFilter, setTimeFilter] = useState('this-week');
    
    // Flexible start and end date states (defaulting to last 30 days)
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const toast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [nvlData, prodData, txData, spTxData, ordersData] = await Promise.all([
                fetchApi('/api/nvl'),
                fetchApi('/api/san-pham'),
                fetchApi('/api/nvl/transactions/all'),
                fetchApi('/api/san-pham/transactions/all'),
                fetchApi('/api/dinh-muc/lenh-san-xuat')
            ]);
            setNvls(nvlData || []);
            setProducts(prodData || []);
            setNvlTx(txData || []);
            setSpTx(spTxData || []);
            setProdOrders(ordersData || []);
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

    // Active production orders (Chờ cấp phát)
    const pendingOrdersCount = useMemo(() => {
        return prodOrders.filter(o => o.status === 'Chờ cấp phát').length;
    }, [prodOrders]);

    // 2. Filtered transaction count based on selected time range
    const filteredTxCount = useMemo(() => {
        let startDateStr = '';
        let endDateStr = '';
        const today = new Date();
        
        if (timeFilter === 'this-week') {
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today.setDate(diff));
            startDateStr = monday.toISOString().split('T')[0];
            
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            endDateStr = sunday.toISOString().split('T')[0];
        } else if (timeFilter === 'this-month') {
            const year = today.getFullYear();
            const month = today.getMonth();
            startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-31`;
        } else if (timeFilter === 'last-30-days') {
            const start = new Date();
            start.setDate(today.getDate() - 29);
            startDateStr = start.toISOString().split('T')[0];
            endDateStr = today.toISOString().split('T')[0];
        } else if (timeFilter === 'last-6-months') {
            const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
            startDateStr = start.toISOString().split('T')[0];
            endDateStr = today.toISOString().split('T')[0];
        } else if (timeFilter === 'this-year') {
            startDateStr = `${today.getFullYear()}-01-01`;
            endDateStr = `${today.getFullYear()}-12-31`;
        } else if (timeFilter === 'custom') {
            startDateStr = startDate;
            endDateStr = endDate;
        }

        if (!startDateStr || !endDateStr) return 0;

        const countNvl = nvlTx.filter(tx => tx.date >= startDateStr && tx.date <= endDateStr).length;
        const countSp = spTx.filter(tx => tx.date >= startDateStr && tx.date <= endDateStr).length;
        return countNvl + countSp;
    }, [timeFilter, startDate, endDate, nvlTx, spTx]);

    // 3. Prepare daily data for "Tuần này" (Mon - Sun)
    const thisWeekData = useMemo(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        
        const days = [];
        const weekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            days.push({
                date: dateStr,
                name: weekdays[i],
                'Nhập NVL': 0, 'Xuất NVL': 0,
                'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0
            });
        }

        nvlTx.forEach(tx => {
            const match = days.find(d => d.date === tx.date);
            if (match) {
                if (tx.type === 'IN') match['Nhập NVL'] += tx.quantity;
                else if (tx.type === 'OUT') match['Xuất NVL'] += tx.quantity;
            }
        });

        spTx.forEach(tx => {
            const match = days.find(d => d.date === tx.date);
            if (match) {
                if (tx.type === 'IN') match['Sản xuất (IN)'] += tx.quantity;
                else if (tx.type === 'OUT') match['Xuất hàng (OUT)'] += tx.quantity;
            }
        });

        return days.map(d => ({
            ...d,
            'Nhập NVL': parseFloat(d['Nhập NVL'].toFixed(2)),
            'Xuất NVL': parseFloat(d['Xuất NVL'].toFixed(2)),
            'Sản xuất (IN)': parseFloat(d['Sản xuất (IN)'].toFixed(2)),
            'Xuất hàng (OUT)': parseFloat(d['Xuất hàng (OUT)'].toFixed(2))
        }));
    }, [nvlTx, spTx]);

    // 4. Prepare weekly data for "Tháng này"
    const thisMonthData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        
        const weeks = [
            { name: 'Tuần 1 (1-7)', startDay: 1, endDay: 7, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 },
            { name: 'Tuần 2 (8-14)', startDay: 8, endDay: 14, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 },
            { name: 'Tuần 3 (15-21)', startDay: 15, endDay: 21, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 },
            { name: 'Tuần 4 (22-28)', startDay: 22, endDay: 28, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 },
            { name: 'Tuần 5 (29+)', startDay: 29, endDay: 31, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 }
        ];

        const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;

        nvlTx.forEach(tx => {
            if (tx.date.startsWith(prefix)) {
                const dayNum = parseInt(tx.date.split('-')[2]);
                const weekObj = weeks.find(w => dayNum >= w.startDay && dayNum <= w.endDay);
                if (weekObj) {
                    if (tx.type === 'IN') weekObj['Nhập NVL'] += tx.quantity;
                    else if (tx.type === 'OUT') weekObj['Xuất NVL'] += tx.quantity;
                }
            }
        });

        spTx.forEach(tx => {
            if (tx.date.startsWith(prefix)) {
                const dayNum = parseInt(tx.date.split('-')[2]);
                const weekObj = weeks.find(w => dayNum >= w.startDay && dayNum <= w.endDay);
                if (weekObj) {
                    if (tx.type === 'IN') weekObj['Sản xuất (IN)'] += tx.quantity;
                    else if (tx.type === 'OUT') weekObj['Xuất hàng (OUT)'] += tx.quantity;
                }
            }
        });

        return weeks.map(w => ({
            ...w,
            'Nhập NVL': parseFloat(w['Nhập NVL'].toFixed(2)),
            'Xuất NVL': parseFloat(w['Xuất NVL'].toFixed(2)),
            'Sản xuất (IN)': parseFloat(w['Sản xuất (IN)'].toFixed(2)),
            'Xuất hàng (OUT)': parseFloat(w['Xuất hàng (OUT)'].toFixed(2))
        }));
    }, [nvlTx, spTx]);

    // 5. Prepare weekly data for "30 ngày qua"
    const last30DaysData = useMemo(() => {
        const today = new Date();
        const dates = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        
        const weeks = [
            { name: 'Tuần 1', startIdx: 0, endIdx: 6, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 },
            { name: 'Tuần 2', startIdx: 7, endIdx: 13, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 },
            { name: 'Tuần 3', startIdx: 14, endIdx: 20, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 },
            { name: 'Tuần 4', startIdx: 21, endIdx: 29, 'Nhập NVL': 0, 'Xuất NVL': 0, 'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0 }
        ];

        nvlTx.forEach(tx => {
            const idx = dates.indexOf(tx.date);
            if (idx !== -1) {
                const weekObj = weeks.find(w => idx >= w.startIdx && idx <= w.endIdx);
                if (weekObj) {
                    if (tx.type === 'IN') weekObj['Nhập NVL'] += tx.quantity;
                    else if (tx.type === 'OUT') weekObj['Xuất NVL'] += tx.quantity;
                }
            }
        });

        spTx.forEach(tx => {
            const idx = dates.indexOf(tx.date);
            if (idx !== -1) {
                const weekObj = weeks.find(w => idx >= w.startIdx && idx <= w.endIdx);
                if (weekObj) {
                    if (tx.type === 'IN') weekObj['Sản xuất (IN)'] += tx.quantity;
                    else if (tx.type === 'OUT') weekObj['Xuất hàng (OUT)'] += tx.quantity;
                }
            }
        });

        return weeks.map(w => ({
            ...w,
            'Nhập NVL': parseFloat(w['Nhập NVL'].toFixed(2)),
            'Xuất NVL': parseFloat(w['Xuất NVL'].toFixed(2)),
            'Sản xuất (IN)': parseFloat(w['Sản xuất (IN)'].toFixed(2)),
            'Xuất hàng (OUT)': parseFloat(w['Xuất hàng (OUT)'].toFixed(2))
        }));
    }, [nvlTx, spTx]);

    // 6. Prepare monthly data for "6 tháng qua"
    const last6MonthsData = useMemo(() => {
        const today = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const prefix = `${y}-${String(m).padStart(2, '0')}`;
            months.push({
                prefix,
                name: `Tháng ${m}/${y}`,
                'Nhập NVL': 0, 'Xuất NVL': 0,
                'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0
            });
        }

        nvlTx.forEach(tx => {
            const prefix = tx.date.substring(0, 7);
            const match = months.find(m => m.prefix === prefix);
            if (match) {
                if (tx.type === 'IN') match['Nhập NVL'] += tx.quantity;
                else if (tx.type === 'OUT') match['Xuất NVL'] += tx.quantity;
            }
        });

        spTx.forEach(tx => {
            const prefix = tx.date.substring(0, 7);
            const match = months.find(m => m.prefix === prefix);
            if (match) {
                if (tx.type === 'IN') match['Sản xuất (IN)'] += tx.quantity;
                else if (tx.type === 'OUT') match['Xuất hàng (OUT)'] += tx.quantity;
            }
        });

        return months.map(m => ({
            ...m,
            'Nhập NVL': parseFloat(m['Nhập NVL'].toFixed(2)),
            'Xuất NVL': parseFloat(m['Xuất NVL'].toFixed(2)),
            'Sản xuất (IN)': parseFloat(m['Sản xuất (IN)'].toFixed(2)),
            'Xuất hàng (OUT)': parseFloat(m['Xuất hàng (OUT)'].toFixed(2))
        }));
    }, [nvlTx, spTx]);

    // 7. Prepare monthly data for "Năm nay"
    const thisYearData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const months = [];
        for (let m = 1; m <= 12; m++) {
            const prefix = `${year}-${String(m).padStart(2, '0')}`;
            months.push({
                prefix,
                name: `T ${m}`,
                'Nhập NVL': 0, 'Xuất NVL': 0,
                'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0
            });
        }

        nvlTx.forEach(tx => {
            const prefix = tx.date.substring(0, 7);
            const match = months.find(m => m.prefix === prefix);
            if (match) {
                if (tx.type === 'IN') match['Nhập NVL'] += tx.quantity;
                else if (tx.type === 'OUT') match['Xuất NVL'] += tx.quantity;
            }
        });

        spTx.forEach(tx => {
            const prefix = tx.date.substring(0, 7);
            const match = months.find(m => m.prefix === prefix);
            if (match) {
                if (tx.type === 'IN') match['Sản xuất (IN)'] += tx.quantity;
                else if (tx.type === 'OUT') match['Xuất hàng (OUT)'] += tx.quantity;
            }
        });

        return months.map(m => ({
            ...m,
            'Nhập NVL': parseFloat(m['Nhập NVL'].toFixed(2)),
            'Xuất NVL': parseFloat(m['Xuất NVL'].toFixed(2)),
            'Sản xuất (IN)': parseFloat(m['Sản xuất (IN)'].toFixed(2)),
            'Xuất hàng (OUT)': parseFloat(m['Xuất hàng (OUT)'].toFixed(2))
        }));
    }, [nvlTx, spTx]);

    // 8. Prepare custom flexible range data
    const customRangeData = useMemo(() => {
        if (timeFilter !== 'custom' || !startDate || !endDate) return [];
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) return [];

        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const formatDateStr = (d) => d.toISOString().split('T')[0];

        // Case A: <= 7 Days -> Group by Day
        if (diffDays <= 7) {
            const days = [];
            for (let i = 0; i < diffDays; i++) {
                const current = new Date(start);
                current.setDate(start.getDate() + i);
                const dateStr = formatDateStr(current);
                const label = current.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
                days.push({
                    date: dateStr,
                    name: label,
                    'Nhập NVL': 0, 'Xuất NVL': 0,
                    'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0
                });
            }

            nvlTx.forEach(tx => {
                const match = days.find(d => d.date === tx.date);
                if (match) {
                    if (tx.type === 'IN') match['Nhập NVL'] += tx.quantity;
                    else if (tx.type === 'OUT') match['Xuất NVL'] += tx.quantity;
                }
            });

            spTx.forEach(tx => {
                const match = days.find(d => d.date === tx.date);
                if (match) {
                    if (tx.type === 'IN') match['Sản xuất (IN)'] += tx.quantity;
                    else if (tx.type === 'OUT') match['Xuất hàng (OUT)'] += tx.quantity;
                }
            });

            return days.map(d => ({
                ...d,
                'Nhập NVL': parseFloat(d['Nhập NVL'].toFixed(2)),
                'Xuất NVL': parseFloat(d['Xuất NVL'].toFixed(2)),
                'Sản xuất (IN)': parseFloat(d['Sản xuất (IN)'].toFixed(2)),
                'Xuất hàng (OUT)': parseFloat(d['Xuất hàng (OUT)'].toFixed(2))
            }));
        }

        // Case B: 8 to 45 Days -> Group by Week
        if (diffDays <= 45) {
            const weeks = [];
            let currentStart = new Date(start);
            let weekNum = 1;

            while (currentStart <= end) {
                const currentEnd = new Date(currentStart);
                currentEnd.setDate(currentStart.getDate() + 6);
                if (currentEnd > end) {
                    currentEnd.setTime(end.getTime());
                }

                const label = `Tuần ${weekNum} (${currentStart.getDate()}/${currentStart.getMonth() + 1} - ${currentEnd.getDate()}/${currentEnd.getMonth() + 1})`;
                weeks.push({
                    name: label,
                    startDateStr: formatDateStr(currentStart),
                    endDateStr: formatDateStr(currentEnd),
                    'Nhập NVL': 0, 'Xuất NVL': 0,
                    'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0
                });

                currentStart.setDate(currentStart.getDate() + 7);
                weekNum++;
            }

            nvlTx.forEach(tx => {
                const weekObj = weeks.find(w => tx.date >= w.startDateStr && tx.date <= w.endDateStr);
                if (weekObj) {
                    if (tx.type === 'IN') weekObj['Nhập NVL'] += tx.quantity;
                    else if (tx.type === 'OUT') weekObj['Xuất NVL'] += tx.quantity;
                }
            });

            spTx.forEach(tx => {
                const weekObj = weeks.find(w => tx.date >= w.startDateStr && tx.date <= w.endDateStr);
                if (weekObj) {
                    if (tx.type === 'IN') weekObj['Sản xuất (IN)'] += tx.quantity;
                    else if (tx.type === 'OUT') weekObj['Xuất hàng (OUT)'] += tx.quantity;
                }
            });

            return weeks.map(w => ({
                ...w,
                'Nhập NVL': parseFloat(w['Nhập NVL'].toFixed(2)),
                'Xuất NVL': parseFloat(w['Xuất NVL'].toFixed(2)),
                'Sản xuất (IN)': parseFloat(w['Sản xuất (IN)'].toFixed(2)),
                'Xuất hàng (OUT)': parseFloat(w['Xuất hàng (OUT)'].toFixed(2))
            }));
        }

        // Case C: > 45 Days -> Group by Month
        const months = [];
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

        while (current <= endMonth) {
            const y = current.getFullYear();
            const m = current.getMonth() + 1;
            const prefix = `${y}-${String(m).padStart(2, '0')}`;
            months.push({
                prefix,
                name: `Tháng ${m}/${y}`,
                'Nhập NVL': 0, 'Xuất NVL': 0,
                'Sản xuất (IN)': 0, 'Xuất hàng (OUT)': 0
            });
            current.setMonth(current.getMonth() + 1);
        }

        nvlTx.forEach(tx => {
            if (tx.date >= startDate && tx.date <= endDate) {
                const prefix = tx.date.substring(0, 7);
                const match = months.find(m => m.prefix === prefix);
                if (match) {
                    if (tx.type === 'IN') match['Nhập NVL'] += tx.quantity;
                    else if (tx.type === 'OUT') match['Xuất NVL'] += tx.quantity;
                }
            }
        });

        spTx.forEach(tx => {
            if (tx.date >= startDate && tx.date <= endDate) {
                const prefix = tx.date.substring(0, 7);
                const match = months.find(m => m.prefix === prefix);
                if (match) {
                    if (tx.type === 'IN') match['Sản xuất (IN)'] += tx.quantity;
                    else if (tx.type === 'OUT') match['Xuất hàng (OUT)'] += tx.quantity;
                }
            }
        });

        return months.map(m => ({
            ...m,
            'Nhập NVL': parseFloat(m['Nhập NVL'].toFixed(2)),
            'Xuất NVL': parseFloat(m['Xuất NVL'].toFixed(2)),
            'Sản xuất (IN)': parseFloat(m['Sản xuất (IN)'].toFixed(2)),
            'Xuất hàng (OUT)': parseFloat(m['Xuất hàng (OUT)'].toFixed(2))
        }));
    }, [timeFilter, startDate, endDate, nvlTx, spTx]);

    // 9. Bind active report data
    const activeData = useMemo(() => {
        switch (timeFilter) {
            case 'this-month':
                return thisMonthData;
            case 'last-30-days':
                return last30DaysData;
            case 'last-6-months':
                return last6MonthsData;
            case 'this-year':
                return thisYearData;
            case 'custom':
                return customRangeData;
            case 'this-week':
            default:
                return thisWeekData;
        }
    }, [timeFilter, thisWeekData, thisMonthData, last30DaysData, last6MonthsData, thisYearData, customRangeData]);

    const isAreaNvl = useMemo(() => {
        if (timeFilter === 'this-week') return true;
        if (timeFilter === 'custom') {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return diffDays <= 7;
        }
        return false;
    }, [timeFilter, startDate, endDate]);

    // 10. Product Department Distribution (Donut Chart)
    const boPhanChartData = useMemo(() => {
        const counts = {};
        products.forEach(p => {
            const bp = p.bo_phan?.trim() || 'Chưa phân loại';
            counts[bp] = (counts[bp] || 0) + 1;
        });
        
        const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b'];
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        
        let rawData = [];
        if (sorted.length > 5) {
            const top = sorted.slice(0, 4);
            const othersCount = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
            top.push(['Khác', othersCount]);
            rawData = top;
        } else {
            rawData = sorted;
        }
        
        return rawData.map(([name, value], i) => ({
            name,
            value,
            color: COLORS[i % COLORS.length]
        }));
    }, [products]);

    // 11. Production Orders Status Distribution (Pie Chart)
    const orderStatusChartData = useMemo(() => {
        const counts = {
            'Chờ cấp phát': 0,
            'Đã cấp phát': 0
        };
        
        prodOrders.forEach(o => {
            const status = o.status || 'Chờ cấp phát';
            counts[status] = (counts[status] || 0) + 1;
        });

        const statusMap = {
            'Chờ cấp phát': { color: '#f59e0b', label: 'Chờ cấp phát' },
            'Đã cấp phát': { color: '#10b981', label: 'Đã cấp phát' }
        };

        return Object.entries(counts).map(([name, value]) => ({
            name: statusMap[name]?.label || name,
            value,
            color: statusMap[name]?.color || '#94a3b8'
        })).filter(item => item.value > 0);
    }, [prodOrders]);

    // 12. Raw Materials by Unit (ĐVT) Distribution (Donut Chart)
    const nvlDvtChartData = useMemo(() => {
        const counts = {};
        nvls.forEach(n => {
            const dvt = n.dvt?.trim() || 'Chưa rõ';
            counts[dvt] = (counts[dvt] || 0) + 1;
        });

        const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316'];
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        
        let rawData = [];
        if (sorted.length > 5) {
            const top = sorted.slice(0, 4);
            const othersCount = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
            top.push(['Khác', othersCount]);
            rawData = top;
        } else {
            rawData = sorted;
        }
        
        return rawData.map(([name, value], i) => ({
            name,
            value,
            color: COLORS[i % COLORS.length]
        }));
    }, [nvls]);

    // 13. Raw Materials Stock Status (Safe vs Warnings)
    const nvlStockStatusChartData = useMemo(() => {
        const warning = nvls.filter(n => n.ton_kho_hien_tai < n.min_inventory).length;
        const safe = nvls.length - warning;
        
        return [
            { name: 'An toàn', value: safe, color: '#10b981' },
            { name: 'Cảnh báo', value: warning, color: '#ef4444' }
        ].filter(item => item.value > 0);
    }, [nvls]);

    // 14. Top 5 Recent Production Orders
    const recentOrders = useMemo(() => {
        return [...prodOrders]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
    }, [prodOrders]);

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

            {/* Page Header with Time Filters */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2>Tổng Quan Hệ Thống</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                        Báo cáo sản lượng, biến động kho nguyên vật liệu, thành phẩm và kế hoạch sản xuất
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {timeFilter === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Từ:</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className="form-input"
                                style={{ 
                                    padding: '5px 10px', 
                                    fontSize: 13, 
                                    width: 140,
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Đến:</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                                className="form-input"
                                style={{ 
                                    padding: '5px 10px', 
                                    fontSize: 13, 
                                    width: 140,
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                    )}
                    <select 
                        value={timeFilter} 
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="form-input"
                        style={{ 
                            width: 190, 
                            fontWeight: 600, 
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            outline: 'none',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            boxShadow: 'var(--shadow-sm)'
                        }}
                    >
                        <option value="this-week">Tuần này</option>
                        <option value="this-month">Tháng này</option>
                        <option value="last-30-days">30 ngày qua</option>
                        <option value="last-6-months">6 tháng qua</option>
                        <option value="this-year">Năm nay</option>
                        <option value="custom">Khoảng ngày tùy chọn</option>
                    </select>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    
                    {/* KPI Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        {/* NVL Count */}
                        <div style={{ 
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
                            borderRadius: '12px', 
                            padding: '18px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
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
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nguyên Vật Liệu</div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                                    {totalNvl} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>loại</span>
                                </div>
                            </div>
                        </div>

                        {/* Product Count */}
                        <div style={{ 
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', 
                            borderRadius: '12px', 
                            padding: '18px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.15)'
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
                                <Layers size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sản Phẩm</div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                                    {totalProd} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>mặt hàng</span>
                                </div>
                            </div>
                        </div>

                        {/* Low Stock Warning */}
                        <div style={{ 
                            background: warningCount > 0 ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #10b981 0%, #047857 100%)', 
                            borderRadius: '12px', 
                            padding: '18px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px',
                            color: '#fff',
                            boxShadow: warningCount > 0 ? '0 4px 12px rgba(239, 68, 68, 0.15)' : '0 4px 12px rgba(16, 185, 129, 0.15)'
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
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cảnh Báo Tồn Kho</div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                                    {warningCount} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>sắp hết</span>
                                </div>
                            </div>
                        </div>

                        {/* Pending Orders */}
                        <div style={{ 
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                            borderRadius: '12px', 
                            padding: '18px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
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
                                <ClipboardList size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lệnh Sản Xuất Chờ</div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                                    {pendingOrdersCount} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>yêu cầu</span>
                                </div>
                            </div>
                        </div>

                        {/* Transactions Count */}
                        <div style={{ 
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
                            borderRadius: '12px', 
                            padding: '18px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.15)'
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
                                <RefreshCw size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Giao Dịch Phát Sinh</div>
                                <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                                    {filteredTxCount} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.75)' }}>phát sinh</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 1: NVL & Product transactions */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 20 }}>
                        {/* NVL Area Chart or Bar Chart */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                                <TrendingUp size={18} color="var(--accent)" />
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Biến động xuất nhập Nguyên Vật Liệu
                                </h3>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                {isAreaNvl ? (
                                    <AreaChart data={activeData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorInNvl" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorOutNvl" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
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
                                        <Area type="monotone" dataKey="Nhập NVL" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInNvl)" />
                                        <Area type="monotone" dataKey="Xuất NVL" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorOutNvl)" />
                                    </AreaChart>
                                ) : (
                                    <BarChart data={activeData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="barInNvl" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                                            </linearGradient>
                                            <linearGradient id="barOutNvl" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                                            </linearGradient>
                                        </defs>
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
                                        <Bar dataKey="Nhập NVL" fill="url(#barInNvl)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                        <Bar dataKey="Xuất NVL" fill="url(#barOutNvl)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>

                        {/* Product Bar Chart */}
                        <div className="card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                                <CheckCircle size={18} color="var(--accent)" />
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Sản lượng sản xuất & Xuất bán Thành Phẩm
                                </h3>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={activeData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="barInSp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8} />
                                        </linearGradient>
                                        <linearGradient id="barOutSp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#ea580c" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
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
                                    <Bar dataKey="Sản xuất (IN)" fill="url(#barInSp)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    <Bar dataKey="Xuất hàng (OUT)" fill="url(#barOutSp)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Row 2: Pie and Donut Charts (4 columns grid) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                        {/* 1. Product Department Donut Chart */}
                        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', height: 320 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Layers size={16} color="var(--accent)" />
                                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Phân bổ Sản Phẩm theo Bộ Phận</h4>
                            </div>
                            <div style={{ width: '100%', height: 180, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={boPhanChartData}
                                            innerRadius={38}
                                            outerRadius={75}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {boPhanChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                                {boPhanChartData.length === 0 ? (
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chưa có dữ liệu</p>
                                ) : (
                                    boPhanChartData.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 2. Production Orders Status Pie Chart */}
                        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', height: 320 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <ClipboardList size={16} color="var(--accent)" />
                                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Tỷ lệ Trạng thái Lệnh Sản Xuất</h4>
                            </div>
                            <div style={{ width: '100%', height: 180, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={orderStatusChartData}
                                            innerRadius={0}
                                            outerRadius={75}
                                            dataKey="value"
                                        >
                                            {orderStatusChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                                {orderStatusChartData.length === 0 ? (
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chưa có lệnh</p>
                                ) : (
                                    orderStatusChartData.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 3. NVL by Unit (ĐVT) Donut Chart */}
                        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', height: 320 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Package size={16} color="var(--accent)" />
                                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Cơ cấu Vật Tư theo ĐVT</h4>
                            </div>
                            <div style={{ width: '100%', height: 180, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={nvlDvtChartData}
                                            innerRadius={38}
                                            outerRadius={75}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {nvlDvtChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                                {nvlDvtChartData.length === 0 ? (
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chưa có dữ liệu</p>
                                ) : (
                                    nvlDvtChartData.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 4. NVL Stock Status Pie Chart (Safe vs Warning) */}
                        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', height: 320 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <AlertTriangle size={16} color="var(--accent)" />
                                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Tỷ lệ An toàn Tồn kho NVL</h4>
                            </div>
                            <div style={{ width: '100%', height: 180, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={nvlStockStatusChartData}
                                            innerRadius={0}
                                            outerRadius={75}
                                            dataKey="value"
                                        >
                                            {nvlStockStatusChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                                {nvlStockStatusChartData.length === 0 ? (
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chưa có dữ liệu</p>
                                ) : (
                                    nvlStockStatusChartData.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Warnings and Recent Production Orders */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 20 }}>
                        {/* Inventory Warnings */}
                        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                                <AlertTriangle size={18} color="var(--danger)" />
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Vật Tư Dưới Mức An Toàn ({warningCount})</h3>
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

                        {/* Recent Production Orders */}
                        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                                <FileText size={18} color="var(--accent)" />
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Lệnh Sản Xuất Gần Đây</h3>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 280 }} className="table-wrapper">
                                <table className="table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Mã Lệnh</th>
                                            <th>Tên Lệnh</th>
                                            <th>Ngày lập</th>
                                            <th style={{ textAlign: 'center' }}>Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                                                    Chưa có lệnh sản xuất nào được lập
                                                </td>
                                            </tr>
                                        ) : (
                                            recentOrders.map(o => (
                                                <tr key={o.id}>
                                                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{o.ma_lenh}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 500 }}>{o.ten_lenh || 'Lệnh sản xuất không tên'}</div>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.notes}</span>
                                                    </td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{o.date}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`badge ${o.status === 'Đã cấp phát' ? 'badge-success' : 'badge-warning'}`}>
                                                            {o.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
