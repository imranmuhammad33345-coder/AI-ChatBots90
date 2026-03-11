import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    
    setError(null);
    setLoading('email');
    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      
      const user = userCredential.user;
      
      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create user profile
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error("Error with email auth:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("An account with this email already exists.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Invalid email or password.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleLogin = async (providerName: string) => {
    setError(null);
    setLoading(providerName);
    try {
      let provider;
      if (providerName === 'google') {
        provider = new GoogleAuthProvider();
      } else if (providerName === 'github') {
        provider = new GithubAuthProvider();
      } else if (providerName === 'apple') {
        provider = new OAuthProvider('apple.com');
      } else if (providerName === 'microsoft') {
        provider = new OAuthProvider('microsoft.com');
      } else {
        throw new Error('Unknown provider');
      }

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create user profile
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error(`Error signing in with ${providerName}:`, err);
      if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized. Please add it to your Firebase Console -> Authentication -> Settings -> Authorized domains.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(`Please enable ${providerName} sign-in in your Firebase Console.`);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in was cancelled.");
      } else {
        setError(err.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-4xl shadow-[0_10px_20px_rgba(79,70,229,0.3),_0_6px_6px_rgba(79,70,229,0.2)] transform hover:-translate-y-1 transition-transform mb-6">
          &sum;
        </div>
        <h2 className="text-center text-4xl font-extrabold tracking-tight text-slate-900 mb-2 drop-shadow-sm">
          UIMath GPT
        </h2>
        <p className="text-center text-base text-slate-600 mb-8 font-medium">
          Your AI-powered multi-subject problem solver
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-[400px]">
        <div className="bg-white px-4 py-8 sm:px-10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] sm:rounded-3xl border border-slate-100">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-b-0 disabled:translate-y-1"
            >
              {loading === 'email' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500 font-medium">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleLogin('google')}
              disabled={loading !== null}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 rounded-xl shadow-sm bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-b-0 disabled:translate-y-1"
            >
              {loading === 'google' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </button>

            <button
              onClick={() => handleLogin('apple')}
              disabled={loading !== null}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 rounded-xl shadow-sm bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-b-0 disabled:translate-y-1"
            >
              {loading === 'apple' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.43.965 3.951.965 1.576.023 2.613-1.444 3.593-2.887 1.133-1.655 1.6-3.257 1.622-3.34-.035-.015-3.134-1.203-3.16-4.802-.026-3.016 2.46-4.464 2.57-4.524-1.421-2.078-3.62-2.35-4.43-2.41-1.803-.153-3.504 1.088-4.43 1.088zm-1.123-5.32c.844-1.02 1.41-2.437 1.255-3.848-1.21.049-2.68.807-3.546 1.843-.77.893-1.442 2.335-1.261 3.722 1.355.105 2.71-.703 3.552-1.717z"/>
                </svg>
              )}
              Continue with Apple
            </button>

            <button
              onClick={() => handleLogin('github')}
              disabled={loading !== null}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 rounded-xl shadow-sm bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-b-0 disabled:translate-y-1"
            >
              {loading === 'github' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              )}
              Continue with GitHub
            </button>

            <button
              onClick={() => handleLogin('microsoft')}
              disabled={loading !== null}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 rounded-xl shadow-sm bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-b-0 disabled:translate-y-1"
            >
              {loading === 'microsoft' ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
                </svg>
              )}
              Continue with Microsoft
            </button>
          </div>

          <div className="mt-8">
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">
                Built by Students, for Students
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
