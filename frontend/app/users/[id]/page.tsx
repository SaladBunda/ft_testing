'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { umGetUser, UMUser } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useAuthGuard';

export default function UserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params?.id as string;
    const { user: currentUser, ensureCsrf } = useAuth();
    const { addFriend, blockUser, clearError } = useUser();
    const { loading: authLoading } = useRequireAuth();
    
    const [user, setUser] = useState<UMUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    if (authLoading) {
        return (
            <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
                <h1>Loading...</h1>
            </main>
        );
    }

    useEffect(() => {
        if (userId) {
            fetchUser();
        }
    }, [userId]);

    const fetchUser = async () => {
        if (!userId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const csrfToken = await ensureCsrf();
            const response = await umGetUser(userId, csrfToken);
            
            if (response.ok) {
                setUser(response.data as UMUser);
            } else {
                setError('User not found');
            }
        } catch (err) {
            setError('Failed to fetch user');
            console.error('User fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddFriend = async () => {
        if (!user) return;
        
        setActionLoading(true);
        try {
            const result = await addFriend(user.id);
            if (result.success) {
                alert(result.message);
            } else {
                alert(result.message);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleBlockUser = async () => {
        if (!user) return;
        
        if (!confirm('Are you sure you want to block this user?')) {
            return;
        }
        
        setActionLoading(true);
        try {
            const result = await blockUser(user.id);
            if (result.success) {
                alert(result.message);
                router.push('/users');
            } else {
                alert(result.message);
            }
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
                <h1>Loading User...</h1>
            </main>
        );
    }

    if (error || !user) {
        return (
            <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>User Not Found</h1>
                    <nav style={{ display: 'flex', gap: 12 }}>
                        <Link href="/users">Back to Users</Link>
                        <Link href="/">Dashboard</Link>
                    </nav>
                </header>
                
                <div style={{ 
                    border: '1px solid #fcc', 
                    padding: 16, 
                    borderRadius: 4,
                    background: '#fee',
                    marginTop: 24
                }}>
                    <p style={{ color: 'crimson', margin: 0 }}>{error}</p>
                </div>
            </main>
        );
    }

    const isCurrentUser = currentUser?.id === user.id;

    return (
        <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>User Profile</h1>
                <nav style={{ display: 'flex', gap: 12 }}>
                    <Link href="/users">Back to Users</Link>
                    <Link href="/">Dashboard</Link>
                    <Link href="/profile">My Profile</Link>
                </nav>
            </header>

            <div style={{ marginTop: 24 }}>
                <div style={{ 
                    border: '1px solid #ddd', 
                    padding: 24, 
                    borderRadius: 8,
                    background: '#f9f9f9'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                        <div style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            background: '#ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            fontWeight: 'bold',
                            color: '#666'
                        }}>
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        
                        <div>
                            <h2 style={{ margin: 0, fontSize: 24 }}>
                                {user.first_name && user.last_name 
                                    ? `${user.first_name} ${user.last_name}` 
                                    : user.username}
                            </h2>
                            <p style={{ margin: '4px 0 0 0', color: '#666' }}>
                                @{user.username}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                <span style={{ 
                                    fontSize: 12,
                                    padding: '4px 12px',
                                    borderRadius: 12,
                                    background: user.is_online ? '#d4edda' : '#f8d7da',
                                    color: user.is_online ? '#155724' : '#721c24'
                                }}>
                                    {user.is_online ? '🟢 Online' : '🔴 Offline'}
                                </span>
                                <span style={{ fontSize: 12, color: '#999' }}>
                                    ID: {user.id}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 16 }}>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Username:</label>
                            <span>{user.username}</span>
                        </div>
                        
                        {user.first_name && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>First Name:</label>
                                <span>{user.first_name}</span>
                            </div>
                        )}
                        
                        {user.last_name && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Last Name:</label>
                                <span>{user.last_name}</span>
                            </div>
                        )}
                        
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Online Status:</label>
                            <span style={{ 
                                color: user.is_online ? 'green' : 'gray',
                                fontWeight: 'bold'
                            }}>
                                {user.is_online ? 'Currently Online' : 'Currently Offline'}
                            </span>
                        </div>
                        
                        {user.profile_pic && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Profile Picture:</label>
                                <span>{user.profile_pic}</span>
                            </div>
                        )}
                        
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Member Since:</label>
                            <span>{new Date(user.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</span>
                        </div>
                        
                        {user.updated_at && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Last Updated:</label>
                                <span>{new Date(user.updated_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</span>
                            </div>
                        )}
                    </div>
                </div>

                {!isCurrentUser && (
                    <div style={{ marginTop: 24 }}>
                        <h3>Actions</h3>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={handleAddFriend}
                                disabled={actionLoading}
                                style={{
                                    padding: '12px 24px',
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: 16
                                }}
                            >
                                {actionLoading ? 'Sending...' : 'Send Friend Request'}
                            </button>
                            
                            <button
                                onClick={handleBlockUser}
                                disabled={actionLoading}
                                style={{
                                    padding: '12px 24px',
                                    background: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: 16
                                }}
                            >
                                {actionLoading ? 'Blocking...' : 'Block User'}
                            </button>
                        </div>
                    </div>
                )}

                {isCurrentUser && (
                    <div style={{ marginTop: 24 }}>
                        <div style={{ 
                            border: '1px solid #ffc107', 
                            padding: 16, 
                            borderRadius: 4,
                            background: '#fff3cd'
                        }}>
                            <p style={{ margin: 0, color: '#856404' }}>
                                This is your own profile. You can edit it from the <Link href="/profile">Profile page</Link>.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
