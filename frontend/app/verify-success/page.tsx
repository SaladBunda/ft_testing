'use client';

import { useRouter } from 'next/navigation';

export default function VerifySuccessPage() {
	const router = useRouter();
	return (
		<main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
			<h1>Email Verified</h1>
			<p style={{ marginTop: 12, color: '#555' }}>
				Your email has been successfully verified. You can now log in.
			</p>
			<div style={{ marginTop: 24 }}>
				<button
					onClick={() => router.replace('/login')}
					style={{ padding: '10px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
				>
					Back to Login
				</button>
			</div>
		</main>
	);
}


