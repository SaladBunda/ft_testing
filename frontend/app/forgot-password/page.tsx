'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireGuest } from '@/hooks/useAuthGuard';
import styles from '../login/LoginPage.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8005';

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	
	const { loading } = useRequireGuest();

	if (loading) {
		return <div>Loading...</div>;
	}

	function isValidEmail(value: string): boolean {
		const trimmed = value.trim();
		if (!trimmed) return false;
		// Simple email validation
		return /.+@.+\..+/.test(trimmed);
	}

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setMessage(null);
		if (!isValidEmail(email)) {
			setError('Please enter a valid email address');
			return;
		}
		setSubmitting(true);
		try {
			// Call backend to issue a reset token email (backend may return 4xx/5xx; we still show generic success)
			await fetch(`${API_BASE}/api/auth/forgot-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email: email.trim() })
			});
			setMessage('If an account exists for this email, we\'ve sent a reset link.');
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
							<h1 className={styles.title}>Forgot your password?</h1>
							<p className={styles.subtitle}>Enter your email and we'll send you a link to reset your password.</p>
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
										placeholder="you@example.com"
										required
									/>
								</div>
							</label>

							<button
								type="submit"
								disabled={submitting || !isValidEmail(email)}
								className={styles.submitBtn}
								style={{ width: '100%' }}
							>
								{submitting ? 'Sending…' : 'Send reset link'}
							</button>

							{message && (
								<p className={styles.error} style={{ background: 'rgba(76, 175, 80, 0.1)', borderColor: 'rgba(76, 175, 80, 0.3)', color: '#81c784' }}>
									{message}
								</p>
							)}

							{error && (
								<p className={styles.error}>{error}</p>
							)}

							<div style={{ marginTop: 16, textAlign: 'center' }}>
								<button
									type="button"
									onClick={() => router.replace('/login')}
									className={styles.forgotBtn}
									style={{ textAlign: 'center', margin: '0 auto' }}
								>
									← Back to Login
								</button>
							</div>
						</form>
					</section>
				</div>
			</div>
		</main>
	);
}