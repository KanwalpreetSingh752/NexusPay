import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface Merchant {
  id: string;
  businessName: string;
  email: string;
  currency: string;
}

interface AuthContextType {
  user: User | null;
  merchant: Merchant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: { accessToken: string; refreshToken: string }, user: User, merchant: Merchant) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nexuspay_access_token');
    const savedUser = localStorage.getItem('nexuspay_user');
    const savedMerchant = localStorage.getItem('nexuspay_merchant');

    if (token && savedUser && savedMerchant) {
      try {
        setUser(JSON.parse(savedUser));
        setMerchant(JSON.parse(savedMerchant));
      } catch (e) {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = (
    tokens: { accessToken: string; refreshToken: string },
    userData: User,
    merchantData: Merchant
  ) => {
    localStorage.setItem('nexuspay_access_token', tokens.accessToken);
    localStorage.setItem('nexuspay_refresh_token', tokens.refreshToken);
    localStorage.setItem('nexuspay_user', JSON.stringify(userData));
    localStorage.setItem('nexuspay_merchant', JSON.stringify(merchantData));

    setUser(userData);
    setMerchant(merchantData);
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('nexuspay_refresh_token');
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('nexuspay_access_token');
    localStorage.removeItem('nexuspay_refresh_token');
    localStorage.removeItem('nexuspay_user');
    localStorage.removeItem('nexuspay_merchant');

    setUser(null);
    setMerchant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        merchant,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
