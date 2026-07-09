const API_BASE = typeof window !== 'undefined'
    ? (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
        ? 'http://' + window.location.hostname + ':3102'
        : '')
    : (process.env.NEXT_PUBLIC_API_URL || '');

export async function fetchApi(path, options = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${path}`.replace('/api/api/', '/api/');
    const res = await fetch(url, {
        ...options,
        headers,
    });

    if (res.status === 401) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        throw new Error('Session expired');
    }

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'An error occurred');
    }

    return data;
}
