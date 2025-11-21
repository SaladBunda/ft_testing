'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TwoFAPage() {
	const { login2fa, isLoggedIn, requires2FA, error, clearError, checkOAuth2FA, cancelTwoFA } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [token, setToken] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [isOAuth, setIsOAuth] = useState(false);

	// Check if this is an OAuth 2FA flow
	useEffect(() => {
		const oauthParam = searchParams.get('oauth');
		const isOAuthParam = oauthParam === 'true';
		const hasPre2faToken = checkOAuth2FA();
		
		setIsOAuth(isOAuthParam || hasPre2faToken);
	}, [searchParams, checkOAuth2FA]);

	// Redirect if already logged in (no 2FA needed)
	useEffect(() => {
		if (isLoggedIn && !requires2FA) {
			router.replace('/');
		}
	}, [isLoggedIn, requires2FA, router]);

	// Redirect if no 2FA required and not from OAuth
	useEffect(() => {
		// Only redirect if we're sure there's no OAuth flow and no 2FA requirement
		// Add a small delay to allow AuthContext to initialize
		const timer = setTimeout(() => {
			console.log('🔍 [TwoFA Debug] Redirect check - requires2FA:', requires2FA, 'isOAuth:', isOAuth);
			if (!requires2FA && !isOAuth) {
				console.log('🔍 [TwoFA Debug] Redirecting to login - no 2FA required and not OAuth');
				router.replace('/login');
			}
		}, 100); // Small delay to allow AuthContext to initialize

		return () => clearTimeout(timer);
	}, [requires2FA, isOAuth, router]);

	async function onSubmit(e: any) {
		e.preventDefault();
		if (!token.trim()) return;
		
		clearError();
		setSubmitting(true);
		try {
			await login2fa(token.trim());
			// login2fa will handle setting isLoggedIn and clearing requires2FA
			// The useEffect above will redirect to home page
		} finally {
			setSubmitting(false);
		}
	}

	// Don't render anything if we should redirect
	if (isLoggedIn && !requires2FA) {
		return null;
	}

	if (!requires2FA && !isOAuth) {
		return null;
	}

	return (
		<main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 420, margin: '0 auto' }}>
			<h1>Two-Factor Authentication</h1>
			<p style={{ marginBottom: 24, color: '#666' }}>
				{isOAuth 
					? 'Complete your OAuth login by entering your 6-digit authenticator code.'
					: 'Enter your 6-digit authenticator code to complete login.'
				}
			</p>
			
			<form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
				<label>
					<span>Authentication Code</span>
					<input 
						type="text"
						value={token}
						onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))} 
						placeholder="123456"
						maxLength={6}
						inputMode="numeric"
						required 
						style={{
							width: '100%', 
							padding: 12, 
							fontSize: 18,
							textAlign: 'center',
							letterSpacing: '0.2em'
						}}
					/>
				</label>
				<button 
					type="submit" 
					disabled={submitting || token.length !== 6} 
					style={{ 
						padding: 12,
						backgroundColor: token.length === 6 ? '#007bff' : '#ccc',
						color: 'white',
						border: 'none',
						borderRadius: 4
					}}
				>
					{submitting ? 'Verifying...' : 'Verify & Continue'}
				</button>
			</form>

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

			<div style={{ marginTop: 24, textAlign: 'center' }}>
				<button 
					onClick={() => { try {
						cancelTwoFA(); 
					} catch (_e) {
					
					} router.replace('/login'); }}
					style={{
						background: 'none',
						border: 'none',
						color: '#666',
						textDecoration: 'underline',
						cursor: 'pointer'
					}}
				>
					← Back to Login
				</button>
			</div>
		</main>
	);
}
