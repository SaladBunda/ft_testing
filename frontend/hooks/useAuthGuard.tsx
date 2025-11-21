'use client';

// UseRequireAuth  - redirect to login if not authenticated
// UseRequireGuest - redirect to home if authenticated
// userRequireProfileComplete - redirect to complete profile if profile is not complete

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {umProfileComplete} from '@/lib/api';

// hook should return the following types:
type AuthGuardResult = {
    loading: boolean;
    isAuthenticated: boolean;
    isProfileComplete:boolean;
}

// hook for pages that require authentication.
export function useRequireAuth(): AuthGuardResult {
    const { isLoggedIn, loading, ensureCsrf } = useAuth();
    const router = useRouter();
    const [isProfileCompleted, setIsProfileCompleted] = useState<boolean>(false);
    const [profileLoading, setProfileLoading] = useState<boolean>(false);
    
    useEffect(() => {
        if (!loading && !isLoggedIn) {
            router.replace('/login');
            return;
        }
        
        if (!loading && isLoggedIn) {
            checkProfileCompletion();
        }
    }, [loading, isLoggedIn, router]);
    
    const checkProfileCompletion = async () => {
        setProfileLoading(true);
        try {
            const crsfToken = await ensureCsrf();
            const result = await umProfileComplete(crsfToken);
            const complete = result.ok && (result.data as any)?.complete;
            setIsProfileCompleted(!!complete);
        } catch (error) {
            console.error('Error checking profile completion:', error);
            setIsProfileCompleted(false);
        } finally {
            setProfileLoading(false);
        }
    }
    
    return {
        loading: loading || profileLoading,
        isAuthenticated: isLoggedIn,
        isProfileComplete: isProfileCompleted,
    }
}

// hook for pages that should only be accessible to guests (not authenticated).
export function useRequireGuest(): AuthGuardResult {
    const {isLoggedIn, loading} = useAuth();
    
    const router = useRouter();
    
    useEffect(() => {
        if (!loading && isLoggedIn) {
            router.replace('/');
        }
    }, [loading, isLoggedIn, router]);
    
    return {
        loading,
        isAuthenticated: isLoggedIn,
        isProfileComplete: false,
    }
}

// hook for pages that require a complete profile.
export function useRequireProfileComplete(): AuthGuardResult {
    const { isLoggedIn, loading, ensureCsrf } = useAuth();
    const router = useRouter();
    const [ isProfileComplete, setIsProfileComplete ] = useState<boolean>(false);
    const [ profileLoading, setProfileLoading ] = useState<boolean>(false);
    
    useEffect(() => {
        if (!loading && !isLoggedIn) {
            router.replace('/login');
            return;
        }
        
        if (!loading && isLoggedIn) {
            checkProfileCompletion();
        }
    }, [loading, isLoggedIn, router]);
    
    // Separate useEffect to handle redirect when profile is incomplete
    useEffect(() => {
        if (!loading && !profileLoading && isLoggedIn && !isProfileComplete) {
            router.replace('/complete-profile');
        }
    }, [loading, profileLoading, isLoggedIn, isProfileComplete, router]);
    
    const checkProfileCompletion = async () => {
        setProfileLoading(true);
        try {
            const crsfToken = await ensureCsrf();
            const result = await umProfileComplete(crsfToken);
            const complete = result.ok && (result.data as any)?.complete;
            setIsProfileComplete(!!complete);
        } catch (error) {
            console.error('Error checking profile completion:', error);
            setIsProfileComplete(false);
        } finally {
            setProfileLoading(false);
        }
    }
    
    return {
        loading: loading || profileLoading,
        isAuthenticated: isLoggedIn,
        isProfileComplete,
    }
    
}

export function useAuthState(): AuthGuardResult {
    const { isLoggedIn, loading, ensureCsrf } = useAuth();
    const [isProfileComplete, setIsProfileComplete] = useState<boolean>(true);
    const [profileLoading, setProfileLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!loading && isLoggedIn) {
            checkProfileCompletion();
            return;
        }
    }, [loading, isLoggedIn]);

    const checkProfileCompletion = async () => {
        setProfileLoading(true);
        try {
            const csrfToken = await ensureCsrf();
            const result = await umProfileComplete(csrfToken);
            const complete = result.ok && (result.data as any)?.complete;
            setIsProfileComplete(!!complete);
        } catch (error) {
            console.error('Profile completion check failed:', error);
            setIsProfileComplete(false);
        } finally {
            setProfileLoading(false);
        }
    };

    return {
        loading: loading || profileLoading,
        isAuthenticated: isLoggedIn,
        isProfileComplete,
    };
}