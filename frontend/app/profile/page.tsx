'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useAuthGuard';

export default function ProfilePage() {
    const { profile, loading, error, updateOnlineStatus, clearError } = useUser();
    
    const { loading: authLoading, isProfileComplete } = useRequireAuth();
    
    const { logout } = useAuth();
    
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    
    if (authLoading) {
        return (
            <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
                <h1>Loading...</h1>
            </main>
        );
    }

    const handleStatusToggle = async () => {
        if (!profile) return;
        setIsUpdatingStatus(true);
        try {
            await updateOnlineStatus(profile.is_online === 0);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    return (
        <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>My Profile</h1>
                <nav style={{ display: 'flex', gap: 12 }}>
                    <Link href="/">Dashboard</Link>
                    <Link href="/users">Users</Link>
                    <button onClick={logout} style={{ padding: 8 }}>
                        Logout
                    </button>
                </nav>
            </header>

            {error && (
                <div style={{ 
                    background: '#fee', 
                    border: '1px solid #fcc', 
                    padding: 12, 
                    marginBottom: 16,
                    borderRadius: 4 
                }}>
                    <p style={{ color: 'crimson', margin: 0 }}>{error}</p>
                    <button onClick={clearError} style={{ marginTop: 8, padding: 4 }}>
                        Dismiss
                    </button>
                </div>
            )}

            {profile ? (
                <div style={{ marginTop: 24 }}>
                    <div style={{ 
                        border: '1px solid #ddd', 
                        padding: 24, 
                        borderRadius: 8,
                        background: '#f9f9f9'
                    }}>
                        <h2>Profile Information</h2>
                        
                        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>User ID:</label>
                                <span>{profile.id}</span>
                            </div>
                            
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>Username:</label>
                                <span>{profile.username}</span>
                            </div>
                            
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>First Name:</label>
                                <span>{profile.first_name || 'Not set'}</span>
                            </div>
                            
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>Last Name:</label>
                                <span>{profile.last_name || 'Not set'}</span>
                            </div>
                            
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>Online Status:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ 
                                        color: profile.is_online ? 'green' : 'gray',
                                        fontWeight: 'bold'
                                    }}>
                                        {profile.is_online ? 'Online' : 'Offline'}
                                    </span>
                                    <button 
                                        onClick={handleStatusToggle}
                                        disabled={isUpdatingStatus}
                                        style={{ 
                                            padding: '4px 8px',
                                            background: profile.is_online ? '#ff6b6b' : '#51cf66',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: isUpdatingStatus ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {isUpdatingStatus ? 'Updating...' : 
                                         (profile.is_online ? 'Go Offline' : 'Go Online')}
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>Profile Picture:</label>
                                <span>{profile.profile_pic || 'Not set'}</span>
                            </div>
                            
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>Member Since:</label>
                                <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                        <h3>Quick Actions</h3>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <Link 
                                href="/users" 
                                style={{ 
                                    padding: '8px 16px', 
                                    background: '#007bff', 
                                    color: 'white', 
                                    textDecoration: 'none',
                                    borderRadius: 4
                                }}
                            >
                                Browse Users
                            </Link>
                            <button 
                                onClick={() => window.location.reload()}
                                style={{ 
                                    padding: '8px 16px', 
                                    background: '#6c757d', 
                                    color: 'white', 
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Refresh Profile
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ 
                    border: '1px solid #ffc107', 
                    padding: 16, 
                    borderRadius: 4,
                    background: '#fff3cd'
                }}>
                    <h3>No Profile Found</h3>
                    <p>A profile will be created automatically when you first interact with the user management system.</p>
                    <Link href="/users" style={{ color: '#856404' }}>
                        Visit Users page to create your profile
                    </Link>
                </div>
            )}
        </main>
    );
}
