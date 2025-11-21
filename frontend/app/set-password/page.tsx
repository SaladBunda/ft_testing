'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8005';

export default function SetPasswordPage() {
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            router.push('/login');
        }
    }, [token, router]);
    
    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/api/auth/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                setError(data?.error || 'Password update failed');
                return;
            }
            
            setMessage(data?.message || 'Password updated successfully');
            
            // Handle redirect for OAuth users
            if (data?.redirect) {
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 2000);
            } else {
                // For password reset, redirect to login after success
                setTimeout(() => {
                    router.push('/login?reset=success');
                }, 2000);
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };
    
    return (
        <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 420, margin: '0 auto' }}>
            <h1>Set Password</h1>
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
                <label>
                    <span>New Password</span>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
                        required 
                        style={{ width: '100%', padding: 8 }} 
                    />
                </label>
                <button type="submit" disabled={submitting || !password} style={{ padding: 10 }}>
                    {submitting ? 'Setting Password…' : 'Set Password'}
                </button>
            </form>
            {message && (
                <p style={{ 
                    color: 'green', 
                    marginTop: 12,
                    padding: 8,
                    backgroundColor: '#e6ffe6',
                    border: '1px solid #ccffcc',
                    borderRadius: 4
                }}>
                    {message}
                </p>
            )}
            {error && (
                <p style={{ 
                    color: 'crimson', 
                    marginTop: 12,
                    padding: 8,
                    backgroundColor: '#ffe6e6',
                    border: '1px solid #ffcccc',
                    borderRadius: 4
                }}>
                    {error}
                </p>
            )}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button 
                    type="button"
                    onClick={() => router.push('/login')}
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#666', 
                        textDecoration: 'underline', 
                        cursor: 'pointer', 
                        padding: 0 
                    }}
                >
                    ← Back to Login
                </button>
            </div>
        </main>
    );
}