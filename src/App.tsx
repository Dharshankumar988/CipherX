import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';
import { Pending } from './pages/Pending';
import { Settings } from './pages/Settings';

import { ShieldAlert } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({ children, requireAdmin }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return (
    <div className="flex-1 bg-cyber-bg flex flex-col items-center justify-center text-cyber-neon min-h-screen">
      <ShieldAlert className="w-16 h-16 mb-6 animate-pulse text-cyber-accent" />
      <div className="text-xl md:text-2xl font-bold tracking-widest uppercase mb-4">Initializing Secure Connection</div>
      <div className="w-64 h-1 bg-cyber-bg border border-cyber-secondary/30 rounded overflow-hidden">
        <div className="h-full bg-cyber-accent animate-[pulse_1.5s_ease-in-out_infinite] w-full origin-left scale-x-100"></div>
      </div>
      <div className="text-cyber-secondary text-xs mt-4 uppercase tracking-widest animate-pulse">Decrypting User Profile...</div>
    </div>
  );
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (profile?.status === 'pending') return <Navigate to="/pending" replace />;
  if (requireAdmin && profile?.role !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<Pending />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requireAdmin>
                <Admin />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
