'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRequireGuest } from '@/hooks/useAuthGuard';
import styles from './LoginPage.module.css';

export default function LoginPage() {
	const { login, requires2FA, error, clearError } = useAuth();
	const { loading } = useRequireGuest();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [oauthError, setOauthError] = useState<string | null>(null);
	const [forgotPassword, setForgotPassword] = useState(false);

	useEffect(() => {
		if (requires2FA) router.replace('/twofa');
	}, [requires2FA, router]);
	
	useEffect(() => { 
		if (forgotPassword) router.push('/forgot-password');
	}, [forgotPassword, router]);
	
	useEffect(() => {
		const errorParam = searchParams.get('error');
		const verifiedParam = searchParams.get('verified');
		if (errorParam) {
			let errorMessage = 'OAuth login failed';
			switch (errorParam) {
				case 'oauth_cancelled':
					errorMessage = 'OAuth login was cancelled';
					break;
				case 'oauth_failed':
					errorMessage = 'OAuth login failed. Please try again.';
					break;
				case '2fa_setup_required':
					errorMessage = 'Please complete 2FA setup before logging in.';
					break;
				default:
					errorMessage = `OAuth error: ${errorParam}`;
			}
			setOauthError(errorMessage);
		}
		if (verifiedParam === '1') {
			setOauthError('Email verified. You can now log in.');
		}
	}, [searchParams]);

	if (loading) {
		return <div>Loading...</div>;
	}

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		clearError();
		setSubmitting(true);
		try {
			await login(email.trim(), password);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className={styles.page}>
			<div className={styles.container}>

				<div className={styles.grid}>
					<section className={`${styles.card} ${styles.loginCard}`}>
						<div className={styles.cardHeader}>
							<h1 className={styles.title}>Welcome back</h1>
							<p className={styles.subtitle}>Sign in to continue to your account</p>
						</div>
						<form className={styles.form} onSubmit={onSubmit}>
							<label className={styles.field}>
								<span>Email</span>
								<div className={styles.inputWrapper}>
									<input
										className={styles.input}
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										placeholder="you@example.com"
									/>
								</div>
							</label>

							<label className={styles.field}>
								<span>Password</span>
								<div className={styles.inputWrapper}>
									<input
										className={styles.input}
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										placeholder="••••••••"
									/>
								</div>
								<span className={styles.fieldHint}>Use at least 12 characters.</span>
							</label>

							<div className={styles.formActions}>
								<button
									type="button"
									className={styles.forgotBtn}
									onClick={ async () => { setForgotPassword(true); } }
								>
									Forgot password
								</button>
								<button type="submit" disabled={submitting} className={styles.submitBtn}>
									{submitting ? 'Signing in…' : 'Continue'}
								</button>
							</div>

							<div className={styles.oauthBlock}>
								<div className={styles.divider}>or</div>
								<a
									className={styles.googleBtn}
									href={`${process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8005'}/api/auth/google`}
								>
									<svg className={styles.googleIcon} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M17.64 9.20454C17.64 8.56636 17.5827 7.95272 17.4764 7.36363H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20454Z" fill="#4285F4"/>
										<path d="M9 18C11.43 18 13.467 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65454 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
										<path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
										<path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65454 3.57955 9 3.57955Z" fill="#EA4335"/>
									</svg>
									Continue with Google
								</a>
							</div>

							{(error || oauthError) && (
								<p className={styles.error}>{error || oauthError}</p>
							)}
						</form>
					</section>
				</div>
			</div>
		</main>
	);
}


