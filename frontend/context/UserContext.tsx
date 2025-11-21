'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { umListUsers, umGetMe, umGetUser, umUpdateStatus, umAddFriend, umBlockUser, UMUser } from '@/lib/api';
import { useAuth } from './AuthContext';

type UserContextValue = {
    // Current user profile
    profile: UMUser | null;
    
    // Users list and search
    users: UMUser[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    
    // Loading states
    loading: boolean;
    usersLoading: boolean;
    
    // Error handling
    error: string | null;
    
    // Actions
    fetchProfile: () => Promise<void>;
    fetchUsers: () => Promise<void>;
    searchUsers: (query: string) => Promise<void>;
    updateOnlineStatus: (isOnline: boolean) => Promise<void>;
    addFriend: (userId: number) => Promise<{ success: boolean; message: string }>;
    blockUser: (userId: number) => Promise<{ success: boolean; message: string }>;
    
    // Utility functions
    clearError: () => void;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { isLoggedIn, ensureCsrf } = useAuth();
    
    // State
    const [profile, setProfile] = useState<UMUser | null>(null);
    const [users, setUsers] = useState<UMUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [usersLoading, setUsersLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Clear error function
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Fetch current user profile
    const fetchProfile = useCallback(async () => {
        if (!isLoggedIn) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const csrfToken = await ensureCsrf();
            const response = await umGetMe(csrfToken);
            
            if (response.ok) {
                setProfile(response.data as UMUser);
            } else {
                setError('Failed to fetch profile');
            }
        } catch (err) {
            setError('Failed to fetch profile');
            console.error('Profile fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [isLoggedIn, ensureCsrf]);

    // Fetch all users
    const fetchUsers = useCallback(async () => {
        if (!isLoggedIn) return;
        
        setUsersLoading(true);
        setError(null);
        
        try {
            const csrfToken = await ensureCsrf();
            const response = await umListUsers('', csrfToken);
            
            if (response.ok) {
                setUsers(response.data as UMUser[]);
            } else {
                setError('Failed to fetch users');
            }
        } catch (err) {
            setError('Failed to fetch users');
            console.error('Users fetch error:', err);
        } finally {
            setUsersLoading(false);
        }
    }, [isLoggedIn, ensureCsrf]);

    // Search users
    const searchUsers = useCallback(async (query: string) => {
        if (!isLoggedIn) return;
        
        setUsersLoading(true);
        setError(null);
        setSearchQuery(query);
        
        try {
            const csrfToken = await ensureCsrf();
            const response = await umListUsers(query, csrfToken);
            
            if (response.ok) {
                setUsers(response.data as UMUser[]);
            } else {
                setError('Failed to search users');
            }
        } catch (err) {
            setError('Failed to search users');
            console.error('Users search error:', err);
        } finally {
            setUsersLoading(false);
        }
    }, [isLoggedIn, ensureCsrf]);

    // Update online status
    const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
        if (!isLoggedIn) return;
        
        try {
            const csrfToken = await ensureCsrf();
            const response = await umUpdateStatus(isOnline, csrfToken);
            
            if (response.ok) {
                // Update local profile state
                setProfile(prev => prev ? { ...prev, is_online: isOnline ? 1 : 0 } : null);
            } else {
                setError('Failed to update status');
            }
        } catch (err) {
            setError('Failed to update status');
            console.error('Status update error:', err);
        }
    }, [isLoggedIn, ensureCsrf]);

    // Add friend
    const addFriend = useCallback(async (userId: number): Promise<{ success: boolean; message: string }> => {
        if (!isLoggedIn) return { success: false, message: 'Not logged in' };
        
        try {
            const csrfToken = await ensureCsrf();
            const response = await umAddFriend(userId, csrfToken);
            
            if (response.ok) {
                return { success: true, message: 'Friend request sent' };
            } else {
                const errorMsg = (response.data as any)?.error || 'Failed to send friend request';
                setError(errorMsg);
                return { success: false, message: errorMsg };
            }
        } catch (err) {
            const errorMsg = 'Failed to send friend request';
            setError(errorMsg);
            console.error('Add friend error:', err);
            return { success: false, message: errorMsg };
        }
    }, [isLoggedIn, ensureCsrf]);

    // Block user
    const blockUser = useCallback(async (userId: number): Promise<{ success: boolean; message: string }> => {
        if (!isLoggedIn) return { success: false, message: 'Not logged in' };
        
        try {
            const csrfToken = await ensureCsrf();
            const response = await umBlockUser(userId, csrfToken);
            
            if (response.ok) {
                return { success: true, message: 'User blocked' };
            } else {
                const errorMsg = (response.data as any)?.error || 'Failed to block user';
                setError(errorMsg);
                return { success: false, message: errorMsg };
            }
        } catch (err) {
            const errorMsg = 'Failed to block user';
            setError(errorMsg);
            console.error('Block user error:', err);
            return { success: false, message: errorMsg };
        }
    }, [isLoggedIn, ensureCsrf]);

    // Auto-fetch profile when user logs in
    useEffect(() => {
        if (isLoggedIn) {
            fetchProfile();
        } else {
            setProfile(null);
            setUsers([]);
            setSearchQuery('');
        }
    }, [isLoggedIn, fetchProfile]);

    const value: UserContextValue = {
        profile,
        users,
        searchQuery,
        setSearchQuery,
        loading,
        usersLoading,
        error,
        fetchProfile,
        fetchUsers,
        searchUsers,
        updateOnlineStatus,
        addFriend,
        blockUser,
        clearError,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
