'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { umUpdateProfile, getCsrfToken } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useAuthGuard';

export default function CompleteProfilePage() {
    const router = useRouter();
    const { profileCheckRedirect, fetchMe } = useAuth();
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [profilePic, setProfilePic] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const { loading: authLoading, isProfileComplete } = useRequireAuth();

    useEffect(() => {
        if (!authLoading && isProfileComplete) {
            router.push('/');
        }
    }, [authLoading, isProfileComplete, router]);
    
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setSubmitting(true);

        try {
            // Validate required fields
            if (!username.trim() || !firstName.trim() || !lastName.trim()) {
                setError('Username, first name, and last name are required');
                setSubmitting(false);
                return;
            }

            // Get CSRF token
            const csrfToken = await getCsrfToken();

            // Update profile
            const result = await umUpdateProfile({
                username: username.trim(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                profile_pic: profilePic.trim() || undefined
            }, csrfToken);

            if (result.ok) {
                setMessage('Profile updated successfully!');
                
                // Refresh profile in auth context
                await fetchMe();

                // Redirect to home or profile page
                setTimeout(() => {
                    router.push('/profile');
                }, 1500);
            } else {
                const errorMsg = (result.data as any)?.error || 'Failed to update profile';
                setError(errorMsg);
            }
        } catch (err) {
            setError('An unexpected error occurred');
            console.error('Profile update error:', err);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto' }}>
            <h1>Complete Your Profile</h1>
            <p>Please complete your profile to continue.</p>
            
            {error && (
                <div style={{ padding: 12, marginBottom: 16, backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: 4, color: '#c00' }}>
                    {error}
                </div>
            )}
            
            {message && (
                <div style={{ padding: 12, marginBottom: 16, backgroundColor: '#efe', border: '1px solid #cfc', borderRadius: 4, color: '#060' }}>
                    {message}
                </div>
            )}

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 'bold' }}>Username *</span>
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                        placeholder="Choose a username"
                        required
                        disabled={submitting}
                        style={{ padding: 8, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 'bold' }}>First Name *</span>
                    <input 
                        type="text" 
                        value={firstName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                        required
                        disabled={submitting}
                        style={{ padding: 8, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 'bold' }}>Last Name *</span>
                    <input 
                        type="text" 
                        value={lastName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                        required
                        disabled={submitting}
                        style={{ padding: 8, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 'bold' }}>Profile Picture URL (optional)</span>
                    <input 
                        type="url" 
                        value={profilePic}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfilePic(e.target.value)}
                        placeholder="https://example.com/profile.jpg"
                        disabled={submitting}
                        style={{ padding: 8, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                </label>

                <button 
                    type="submit" 
                    disabled={submitting}
                    style={{ 
                        padding: 12, 
                        fontSize: 16, 
                        fontWeight: 'bold', 
                        backgroundColor: submitting ? '#ccc' : '#007bff', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 4, 
                        cursor: submitting ? 'not-allowed' : 'pointer' 
                    }}
                >
                    {submitting ? 'Updating...' : 'Complete Profile'}
                </button>
            </form>
        </main>
    );
}