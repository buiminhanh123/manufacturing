'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

import { 
    LayoutDashboard, 
    Boxes,
    ArrowLeftRight,
    ShoppingBag,
    Repeat2,
    FileSpreadsheet, 
    ClipboardList,
    LogOut, 
    Briefcase, 
    ChevronLeft, 
    ChevronRight 
} from 'lucide-react';

const menuItems = [
    { key: 'dashboard',       label: 'Tổng quan',          icon: <LayoutDashboard size={20} />, path: '/' },
    { key: 'tinh-toan',       label: 'Tạo lệnh sản xuất',  icon: <ClipboardList size={20} />,   path: '/tinh-toan' },
    { key: 'dinh-muc',        label: 'Định mức sản phẩm',  icon: <FileSpreadsheet size={20} />, path: '/dinh-muc' },
    { key: 'nvl',             label: 'Vật tư (NVL)',        icon: <Boxes size={20} />,           path: '/nvl' },
    { key: 'nvl-transactions',label: 'Nhập xuất NVL',       icon: <ArrowLeftRight size={20} />,  path: '/nvl/transactions' },
    { key: 'san-pham',        label: 'Sản phẩm',            icon: <ShoppingBag size={20} />,     path: '/san-pham' },
    { key: 'sp-transactions', label: 'Nhập xuất SP',         icon: <Repeat2 size={20} />,         path: '/san-pham/transactions' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout, hasPermission } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('sidebar_collapsed');
        if (saved === 'true') {
            setIsCollapsed(true);
        }
    }, []);

    useEffect(() => {
        if (isCollapsed) {
            document.body.classList.add('sidebar-collapsed');
            localStorage.setItem('sidebar_collapsed', 'true');
        } else {
            document.body.classList.remove('sidebar-collapsed');
            localStorage.setItem('sidebar_collapsed', 'false');
        }
    }, [isCollapsed]);

    if (!user) return null;

    const getInitials = (name) => {
        return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    };

    const visibleItems = menuItems.filter(item => hasPermission(item.key));

    return (
        <aside className="sidebar">
            <button className="sidebar-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <div className="sidebar-logo">
                <div className="sidebar-logo-icon"><Briefcase size={22} /></div>
                <div className="sidebar-logo-text">
                    <h1>Anh Trung</h1>
                    <span>Quản lý Kho &amp; Định mức</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {visibleItems.map(item => (
                    <Link
                        key={item.key}
                        href={item.path}
                        className={`sidebar-nav-item ${pathname === item.path ? 'active' : ''}`}
                        title={isCollapsed ? item.label : ''}
                    >
                        <span className="icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="sidebar-user">
                <div className="sidebar-user-avatar">{getInitials(user.display_name)}</div>
                <div className="sidebar-user-info">
                    <div className="sidebar-user-name">{user.display_name}</div>
                    <div className="sidebar-user-role">{user.role === 'admin' ? 'Admin' : 'Nhân viên'}</div>
                </div>
                <button className="sidebar-logout" onClick={logout} title="Đăng xuất"><LogOut size={18} /></button>
            </div>
        </aside>
    );
}
