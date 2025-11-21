'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useAuthGuard';

export default function UsersPage() {
    const { 
        users, 
        searchQuery, 
        setSearchQuery, 
        usersLoading, 
        error, 
        fetchUsers, 
        searchUsers, 
        addFriend, 
        blockUser, 
        clearError 
    } = useUser();
    const { loading: authLoading} = useRequireAuth();
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    
    useEffect(() => {
        if (!authLoading) {
            fetchUsers();
        }
    }, [authLoading, fetchUsers]);

    const handleSearch = async (query: string) => {
        if (query.trim()) {
            await searchUsers(query);
        } else {
            await fetchUsers();
        }
    };

    const handleAddFriend = async (userId: number) => {
        setActionLoading(userId);
        try {
            const result = await addFriend(userId);
            if (result.success) {
                alert(result.message);
            } else {
                alert(result.message);
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleBlockUser = async (userId: number) => {
        if (!confirm('Are you sure you want to block this user?')) {
            return;
        }
        
        setActionLoading(userId);
        try {
            const result = await blockUser(userId);
            if (result.success) {
                alert(result.message);
                // Refresh the users list
                await fetchUsers();
            } else {
                alert(result.message);
            }
        } finally {
            setActionLoading(null);
        }
    };
    
    if (authLoading) {
        return (
            <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
                <h1>Loading...</h1>
            </main>
        );
    }


    return (
        <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Users</h1>
                <nav style={{ display: 'flex', gap: 12 }}>
                    <Link href="/">Dashboard</Link>
                    <Link href="/profile">Profile</Link>
                    <Link href="/users">Users</Link>
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

            <div style={{ marginTop: 24 }}>
                <div style={{ marginBottom: 24 }}>
                    <h2>Search Users</h2>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Search by username, first name, or last name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearch(searchQuery);
                                }
                            }}
                            style={{
                                flex: 1,
                                padding: 12,
                                border: '1px solid #ddd',
                                borderRadius: 4,
                                fontSize: 16
                            }}
                        />
                        <button
                            onClick={() => handleSearch(searchQuery)}
                            disabled={usersLoading}
                            style={{
                                padding: '12px 24px',
                                background: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: usersLoading ? 'not-allowed' : 'pointer',
                                fontSize: 16
                            }}
                        >
                            {usersLoading ? 'Searching...' : 'Search'}
                        </button>
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    fetchUsers();
                                }}
                                style={{
                                    padding: '12px 16px',
                                    background: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <div>
                    <h2>
                        {searchQuery ? `Search Results for "${searchQuery}"` : 'All Users'}
                        <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666', marginLeft: 12 }}>
                            ({users.length} user{users.length !== 1 ? 's' : ''})
                        </span>
                    </h2>

                    {usersLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <p>Loading users...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: 40,
                            border: '1px solid #ddd',
                            borderRadius: 4,
                            background: '#f9f9f9'
                        }}>
                            <p>No users found.</p>
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        fetchUsers();
                                    }}
                                    style={{
                                        marginTop: 12,
                                        padding: '8px 16px',
                                        background: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Show All Users
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 16 }}>
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: 16,
                                        borderRadius: 8,
                                        background: 'white',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                            <h3 style={{ margin: 0, fontSize: 18 }}>
                                                {user.first_name && user.last_name 
                                                    ? `${user.first_name} ${user.last_name}` 
                                                    : user.username}
                                            </h3>
                                            <span style={{ 
                                                fontSize: 12,
                                                padding: '2px 8px',
                                                borderRadius: 12,
                                                background: user.is_online ? '#d4edda' : '#f8d7da',
                                                color: user.is_online ? '#155724' : '#721c24'
                                            }}>
                                                {user.is_online ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                                            @{user.username}
                                        </p>
                                        <p style={{ margin: 0, color: '#999', fontSize: 12 }}>
                                            Joined {new Date(user.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Link
                                            href={`/users/${user.id}`}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#17a2b8',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: 4,
                                                fontSize: 14
                                            }}
                                        >
                                            View Profile
                                        </Link>
                                        
                                        {user.id !== user.id && (
                                            <>
                                                <button
                                                    onClick={() => handleAddFriend(user.id)}
                                                    disabled={actionLoading === user.id}
                                                    style={{
                                                        padding: '8px 16px',
                                                        background: '#28a745',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                                                        fontSize: 14
                                                    }}
                                                >
                                                    {actionLoading === user.id ? 'Sending...' : 'Add Friend'}
                                                </button>
                                                
                                                <button
                                                    onClick={() => handleBlockUser(user.id)}
                                                    disabled={actionLoading === user.id}
                                                    style={{
                                                        padding: '8px 16px',
                                                        background: '#dc3545',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                                                        fontSize: 14
                                                    }}
                                                >
                                                    {actionLoading === user.id ? 'Blocking...' : 'Block'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
