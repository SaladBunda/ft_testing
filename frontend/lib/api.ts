const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8005';

export type ApiResult<T = any> = {
	ok: boolean;
	status: number;
	data: T | { error?: string } | null;
};

export type UpdateProfileBody = {
	username?: string;
	first_name?: string;
	last_name?: string;
	profile_pic?: string;
}

function isJsonContentType(headers: HeadersInit | undefined): boolean {
	if (!headers) return false;
	const map = new Headers(headers as HeadersInit);
	const value = map.get('Content-Type');
	return !!value && value.toLowerCase().includes('application/json');
}

async function fetchJson<T = any>(path: string, options: RequestInit = {}, csrfToken?: string | null): Promise<ApiResult<T>> {
	const url = `${API_BASE}${path}`;
	const headers: HeadersInit = new Headers(options.headers);
	if (csrfToken) {
		(headers as Headers).set('X-CSRF-Token', csrfToken);
	}
	if (options.body && !isJsonContentType(headers)) {
		(headers as Headers).set('Content-Type', 'application/json');
	}

	const res = await fetch(url, {
		credentials: 'include',
		...options,
		headers,
	});

	// If we get a 401 and this isn't already a refresh request, try to refresh token
	if (res.status === 401 && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
		console.log('🔄 Token expired, attempting automatic refresh...');
		try {
			const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
				method: 'POST',
				credentials: 'include',
				headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
			});
			
			if (refreshRes.ok) {
				console.log('✅ Token refreshed successfully, retrying original request...');
				// Retry the original request with fresh token
				const retryRes = await fetch(url, {
					credentials: 'include',
					...options,
					headers,
				});
				
				let retryData: any = null;
				try {
					retryData = await retryRes.json();
				} catch (_e) {
					retryData = null;
				}
				
				return { ok: retryRes.ok, status: retryRes.status, data: retryData };
			} else {
				console.log('❌ Token refresh failed, user needs to login again');
			}
		} catch (e) {
			console.log('💥 Error during token refresh:', e);
		}
	}

	let data: any = null;
	try {
		data = await res.json();
	} catch (_e) {
		data = null;
	}

	return { ok: res.ok, status: res.status, data };
}

export async function umUpdateProfile(profile: UpdateProfileBody, csrfToken?: string | null): Promise<ApiResult<{ success: boolean }>> {
	return fetchUserMgmtJson<{ success: boolean }>('/me/profile', {
		method: 'PATCH',
		body: JSON.stringify({ profile })
	}, csrfToken);
}

export type CsrfResponse = { csrfToken: string };
export async function getCsrfToken(): Promise<string | null> {
	const result = await fetchJson<CsrfResponse>('/api/csrf-token');
	if (result.ok && (result.data as CsrfResponse)?.csrfToken) {
		return (result.data as CsrfResponse).csrfToken;
	}
	return null;
}

export type RegisterBody = { email: string; password: string };
export async function register(body: RegisterBody, csrfToken?: string | null) {
	return fetchJson('/api/auth/register', {
		method: 'POST',
		body: JSON.stringify(body),
	}, csrfToken);
}

export type LoginBody = { email: string; password: string };
export type LoginResponse = {
	requires2FA?: boolean;
	user?: { id: number; email: string };
	expiresIn?: number;
	tokenType?: string;
};
export async function login(body: LoginBody, csrfToken?: string | null) {
	return fetchJson<LoginResponse>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify(body),
	}, csrfToken);
}

export type Login2FABody = { token: string };
export type Login2FAResponse = LoginResponse;
export async function login2fa(body: Login2FABody, csrfToken?: string | null) {
	return fetchJson<Login2FAResponse>('/api/auth/login/2fa', {
		method: 'POST',
		body: JSON.stringify(body),
	}, csrfToken);
}

export async function logout(csrfToken?: string | null) {
	// No body: avoids sending Content-Type
	return fetchJson('/api/auth/logout', { method: 'POST' }, csrfToken);
}

export async function refresh(csrfToken?: string | null) {
	return fetchJson('/api/auth/refresh', { method: 'POST' }, csrfToken);
}

export type MeResponse = { userId: number };
export async function me(csrfToken?: string | null) {
	return fetchJson<MeResponse>('/api/auth/me', {}, csrfToken);
}

export type TwoFASetupStartResponse = { qrCode: string };
export async function twofaSetupStart(csrfToken?: string | null) {
	return fetchJson<TwoFASetupStartResponse>('/api/auth/2fa/setup-start', { method: 'POST' }, csrfToken);
}

export type TwoFASetupVerifyBody = { token: string };
export type TwoFASetupVerifyResponse = { message: string };
export async function twofaSetupVerify(body: TwoFASetupVerifyBody, csrfToken?: string | null) {
	return fetchJson<TwoFASetupVerifyResponse>('/api/auth/2fa/setup-verify', { method: 'POST', body: JSON.stringify(body) }, csrfToken);
}

export type TwoFADisableBody = { password: string };
export type TwoFADisableResponse = { message: string };
export async function twofaDisable(body: TwoFADisableBody, csrfToken?: string | null) {
	return fetchJson<TwoFADisableResponse>('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify(body) }, csrfToken);
}

export type TwoFAStatusResponse = { enabled: boolean };
export async function twofaStatus(csrfToken?: string | null) {
    return fetchJson<TwoFAStatusResponse>('/api/auth/2fa/status', {}, csrfToken);
}

export function isProfileComplete(profile: UMUser): boolean {
	// Check if username is NOT the default format (user_123)
	const hasCustomUsername = profile.username && !profile.username.match(/^user_\d+$/);

	// Check if first_name and last_name are filled
	const hasFirstName = !!profile.first_name?.trim();
	const hasLastName = !!profile.last_name?.trim();
	
	return !!(hasCustomUsername && hasFirstName && hasLastName);
}

// User-management endpoints (usr-manag microservice)
const USER_MGMT_API_BASE = process.env.NEXT_PUBLIC_USER_MGMT_API_BASE ?? 'http://localhost:4000';

async function fetchUserMgmtJson<T = any>(path: string, options: RequestInit = {}, csrfToken?: string | null): Promise<ApiResult<T>> {
    const url = `${USER_MGMT_API_BASE}${path}`;
    const headers: HeadersInit = new Headers(options.headers);
    
    // Add CSRF token if available
    if (csrfToken) {
        (headers as Headers).set('X-CSRF-Token', csrfToken);
    }
    
    // Set content type for requests with body
    if (options.body && !isJsonContentType(headers)) {
        (headers as Headers).set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
        credentials: 'include', // Important: include cookies for JWT
        ...options,
        headers,
    });

    // If we get a 401, try to refresh token
    if (res.status === 401) {
        console.log('🔄 User mgmt token expired, attempting automatic refresh...');
        try {
            const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
            });
            
            if (refreshRes.ok) {
                console.log('✅ Token refreshed successfully, retrying user mgmt request...');
                // Retry the original request with fresh token
                const retryRes = await fetch(url, {
                    credentials: 'include',
                    ...options,
                    headers,
                });
                
                let retryData: any = null;
                try {
                    retryData = await retryRes.json();
                } catch (_e) {
                    retryData = null;
                }
                
                return { ok: retryRes.ok, status: retryRes.status, data: retryData };
            } else {
                console.log('❌ Token refresh failed for user mgmt request');
            }
        } catch (e) {
            console.log('💥 Error during user mgmt token refresh:', e);
        }
    }

    let data: any = null;
    try {
        data = await res.json();
    } catch (_e) {
        data = null;
    }

    return { ok: res.ok, status: res.status, data };
}

export type UMUser = {
    id: number;
    username: string; 
    first_name?: string; 
    last_name?: string; 
    profile_pic?: string; 
    is_online: number; 
    created_at: string; 
    updated_at?: string; 
};

export type ProfileCompleteResponse = { complete: boolean };
export async function umProfileComplete(csrfToken?: string | null) {
	return fetchUserMgmtJson<ProfileCompleteResponse>('/me/profile/complete', {}, csrfToken);
}

export async function umListUsers(search?: string, csrfToken?: string | null) {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchUserMgmtJson<UMUser[]>(`/users${qs}`, {}, csrfToken);
}

export async function umGetMe(csrfToken?: string | null) {
    return fetchUserMgmtJson<UMUser>('/me', {}, csrfToken);
}

export async function umGetUser(id: string | number, csrfToken?: string | null) {
    return fetchUserMgmtJson<UMUser>(`/users/${id}`, {}, csrfToken);
}

export async function umUpdateStatus(isOnline: boolean, csrfToken?: string | null) {
    return fetchUserMgmtJson<{ success: boolean; is_online: boolean }>('/me/status', {
        method: 'PATCH',
        body: JSON.stringify({ is_online: isOnline })
    }, csrfToken);
}

export async function umDeleteMe(csrfToken?: string | null) {
    return fetchUserMgmtJson<{ success: boolean; message: string }>('/me', { method: 'DELETE' }, csrfToken);
}

export async function umAddFriend(targetId: string | number, csrfToken?: string | null) {
    return fetchUserMgmtJson<{ success: boolean; message: string; requestId: string }>(`/users/${targetId}/friend`, {
        method: 'POST'
    }, csrfToken);
}

export async function umBlockUser(targetId: string | number, csrfToken?: string | null) {
    return fetchUserMgmtJson<{ success: boolean; message: string }>(`/users/${targetId}/block`, {
        method: 'POST'
    }, csrfToken);
}
