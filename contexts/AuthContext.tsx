import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Buscar sessão existente do localStorage
    const storedSession = localStorage.getItem('supabaseSession');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setSession(parsed);
        setUser(parsed?.user ?? null);
        setLoading(false);
      } catch { }
    }
    // Buscar sessão do supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) localStorage.setItem('supabaseSession', JSON.stringify(session));
    });

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session) localStorage.setItem('supabaseSession', JSON.stringify(session));
        else localStorage.removeItem('supabaseSession');
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('Login error:', error.message);
        setLoading(false);
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        localStorage.setItem('supabaseSession', JSON.stringify(data.session));
        setLoading(false); // Force loading to false on success
        return { error: null };
      }

      setLoading(false);
      return { error: 'Sessão não criada' };
    } catch (err) {
      setLoading(false);
      return { error: 'Erro inesperado' };
    }
  };

  const signUp = async (email: string, password: string) => {
    const response = await supabase.auth.signUp({ email, password });
    console.log('Supabase signUp response:', response);
    const { error } = response;
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    localStorage.removeItem('supabaseSession');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
