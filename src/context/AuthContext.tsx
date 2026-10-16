import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { initialUsers } from '../data/seedData';
import { apiClient } from '../lib/apiClient';

interface AuthContextType {
  currentUser: User | null;
  currentSchoolId: string;
  login: (email: string) => boolean;
  loginAsRole: (role: Role) => void;
  logout: () => void;
  switchSchool: (schoolId: string) => void;
  availableUsers: User[];
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('lumeneios_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return initialUsers[0]; // fallback admin
      }
    }
    return initialUsers[0]; // default logged in as Admin for instant stakeholder access
  });

  const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => {
    return localStorage.getItem('lumeneios_current_school') || 'school-1';
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('lumeneios_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('lumeneios_auth_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('lumeneios_current_school', currentSchoolId);
  }, [currentSchoolId]);

  const login = (email: string): boolean => {
    const user = initialUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      setCurrentUser(user);
      setCurrentSchoolId(user.schoolId || 'school-1');
      // Asynchronously obtain token from backend API
      apiClient.auth.login(user.email).catch((err) => {
        console.warn('Backend login sync notice:', err.message);
      });
      return true;
    }
    return false;
  };

  const loginAsRole = (role: Role) => {
    const user = initialUsers.find((u) => u.role === role);
    if (user) {
      setCurrentUser(user);
      setCurrentSchoolId(user.schoolId || 'school-1');
      apiClient.auth.login(user.email).catch((err) => {
        console.warn('Backend login sync notice:', err.message);
      });
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('lumeneios_auth_user');
    apiClient.auth.logout();
  };

  const switchSchool = (schoolId: string) => {
    setCurrentSchoolId(schoolId);
    apiClient.auth.switchSchool(schoolId).catch((err) => {
      console.warn('Backend school switch sync notice:', err.message);
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentSchoolId,
        login,
        loginAsRole,
        logout,
        switchSchool,
        availableUsers: initialUsers,
        isAuthenticated: !!currentUser,
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

