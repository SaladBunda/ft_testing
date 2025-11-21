'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

export default function DebugPage() {
	const { isLoggedIn, requires2FA, loading, checkOAuth2FA } = useAuth();
	const [cookies, setCookies] = useState<string>('');

	useEffect(() => {
		if (typeof document !== 'undefined') {
			setCookies(document.cookie);
		}
	}, []);

	return (
		<main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
			<h1>OAuth Debug Page</h1>
			
			<div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
				<h3>Auth State</h3>
				<p><strong>Loading:</strong> {loading ? 'true' : 'false'}</p>
				<p><strong>Is Logged In:</strong> {isLoggedIn ? 'true' : 'false'}</p>
				<p><strong>Requires 2FA:</strong> {requires2FA ? 'true' : 'false'}</p>
				<p><strong>Has OAuth 2FA Token:</strong> {checkOAuth2FA() ? 'true' : 'false'}</p>
			</div>

			<div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
				<h3>Cookies</h3>
				<pre style={{ fontSize: 12, wordBreak: 'break-all' }}>{cookies || 'No cookies found'}</pre>
			</div>

			<div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
				<h3>Actions</h3>
				<button 
					onClick={() => window.location.reload()}
					style={{ padding: 8, marginRight: 8 }}
				>
					Refresh Page
				</button>
				<button 
					onClick={() => window.location.href = '/login'}
					style={{ padding: 8, marginRight: 8 }}
				>
					Go to Login
				</button>
				<button 
					onClick={() => window.location.href = '/twofa?oauth=true'}
					style={{ padding: 8 }}
				>
					Go to TwoFA (OAuth)
				</button>
			</div>

			<div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
				<h3>OAuth Test</h3>
				<a 
					href={`${process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8005'}/api/auth/google`}
					style={{ 
						display: 'inline-block',
						padding: '10px 20px',
						backgroundColor: '#4285f4',
						color: 'white',
						textDecoration: 'none',
						borderRadius: '4px'
					}}
				>
					Test Google OAuth
				</a>
			</div>
		</main>
	);
}
