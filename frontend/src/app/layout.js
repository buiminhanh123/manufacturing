import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata = {
    title: 'Quản lý Kho & Định Mức NVL Anh Trung',
    description: 'Hệ thống quản lý nhập xuất tồn kho nguyên vật liệu, sản phẩm và định mức chế tạo',
};

export default function RootLayout({ children }) {
    return (
        <html lang="vi" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <ClientLayout>{children}</ClientLayout>
            </body>
        </html>
    );
}
