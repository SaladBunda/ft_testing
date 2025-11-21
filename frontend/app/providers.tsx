'use client';

import { AuthProvider } from '../context/AuthContext';
import { UserProvider } from '../context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8005';

function FetchInterceptor({ children }: { children?: React.ReactNode }) {
	const { csrfToken } = useAuth();
	const originalFetchRef = useRef<typeof fetch | null>(null);
	const csrfRef = useRef<string | null>(null);

	// Keep latest CSRF token in a ref so the interceptor reads fresh value
	useEffect(() => {
		csrfRef.current = csrfToken ?? null;
	}, [csrfToken]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (!originalFetchRef.current) {
			originalFetchRef.current = window.fetch.bind(window);
			window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
				const orig = originalFetchRef.current!;
				let urlString: string;
				if (typeof input === 'string') urlString = input;
				else if (input instanceof URL) urlString = input.toString();
				else urlString = input.url;

				const isApi = urlString.startsWith(API_BASE);
				const headers = new Headers(init?.headers);
				const finalInit: RequestInit = {
					credentials: 'include',
					...init,
					headers,
				};

				if (isApi) {
					const token = csrfRef.current;
					if (token && !headers.has('X-CSRF-Token')) {
						headers.set('X-CSRF-Token', token);
					}
				}

				try {
					return await orig(input as any, finalInit);
				} catch (err: any) {
					// Convert network failures to a Response for API calls to avoid unhandled rejections in UI
					if (isApi) {
						const body = JSON.stringify({ error: 'Network error', detail: String(err && err.message || err) });
						return new Response(body, { status: 503, headers: { 'Content-Type': 'application/json' } }) as any;
					}
					throw err;
				}
			}) as typeof fetch;
		}

		return () => {
			if (originalFetchRef.current) {
				window.fetch = originalFetchRef.current as typeof fetch;
				originalFetchRef.current = null;
			}
		};
	}, []);

	return <>{children}</>;
}

function OAuthCallbackHandler({ children }: { children?: React.ReactNode }) {
	const router = useRouter();
	const searchParams = useSearchParams();
    const { checkOAuth2FA, checkProfileAndRedirect, isLoggedIn } = useAuth();

	useEffect(() => {
		// Handle OAuth callback parameters
		const loginParam = searchParams.get('login');
		const errorParam = searchParams.get('error');

		console.log('🔍 [OAuth Debug] OAuthCallbackHandler - loginParam:', loginParam, 'errorParam:', errorParam);

		if (loginParam === 'success') {
			console.log('🎉 [OAuth Debug] OAuth login successful');
			// Check if we need 2FA
			if (checkOAuth2FA()) {
				console.log('🔐 [OAuth Debug] OAuth requires 2FA, redirecting to /twofa');
				router.push('/twofa?oauth=true');
			} else {
				// No 2FA needed, redirect to home
				( async () => { await checkProfileAndRedirect(); } )();
			}
		} else if (errorParam) {
			console.log('❌ [OAuth Debug] OAuth error:', errorParam);
			// Redirect to login page with error
			router.push(`/login?error=${errorParam}`);
		}
    }, [searchParams, router, checkOAuth2FA, checkProfileAndRedirect]);

    // Global guard: when user is logged in, ensure profile completion redirect is applied
    // useEffect(() => {
    //     if (!isLoggedIn) return;
    //     (async () => { await checkProfileAndRedirect(); })();
    // }, [isLoggedIn, checkProfileAndRedirect]);

	return <>{children}</>;
}

export default function Providers({ children }: { children?: React.ReactNode }) {
	return (
		<AuthProvider>
			<UserProvider>
				<FetchInterceptor>
					<OAuthCallbackHandler children={children ?? null} />
				</FetchInterceptor>
			</UserProvider>
		</AuthProvider>
	);
}


