import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { SubmitFeedbackView } from './components/SubmitFeedbackView';
import { Toast } from './components/Toast';
import {
  ADMIN_EMAIL,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import type { FeedbackRecord, ViewMode } from './types/feedback';

function FeedbackHubApp() {
  const [activeView, setActiveView] = useState<ViewMode>('submit');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeSessionFromUrl = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionParam = params.get('session');
      return sessionParam && sessionParam.trim() !== '' ? sessionParam.trim() : null;
    } catch {
      return null;
    }
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setFeedbacks([]);
      setIsLoadingFeedbacks(false);
      return;
    }

    setIsLoadingFeedbacks(true);
    const path = 'feedbacks';
    const isAdminUser = user.email === ADMIN_EMAIL && user.emailVerified;
    const feedbacksRef = collection(db, path);
    const q = isAdminUser
      ? feedbacksRef
      : query(feedbacksRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: FeedbackRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            type: data.type ?? 'good',
            sessionName: data.sessionName ?? 'General Session',
            learningPoints: data.learningPoints ?? '',
            suggestions: data.suggestions ?? '',
            userId: data.userId ?? '',
            timestamp: data.timestamp ?? null,
          };
        });
        setFeedbacks(rows);
        setIsLoadingFeedbacks(false);
      },
      (error) => {
        setIsLoadingFeedbacks(false);
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Quota exceeded')) {
          showToast('Daily database quota exceeded. Please try again tomorrow.');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, showToast]);

  const handleSignIn = useCallback(async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      showToast(`Signed in as ${result.user.displayName || result.user.email}`);
      return result.user;
    } catch (error) {
      console.error('Sign in failed:', error);
      showToast('Google Sign-In was cancelled or failed.');
      return null;
    }
  }, [showToast]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      showToast('Signed out successfully.');
    } catch (error) {
      console.error('Sign out failed:', error);
      showToast('Failed to sign out.');
    }
  }, [showToast]);

  return (
    <div className="min-h-screen flex flex-col bg-[#cce6f4]">
      <Toast message={toastMessage} />

      <Header
        activeView={activeView}
        onSwitchView={setActiveView}
        user={user}
        authReady={authReady}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center justify-center">
        {activeView === 'submit' ? (
          <SubmitFeedbackView
            activeSessionFromUrl={activeSessionFromUrl}
            user={user}
            onRequireSignIn={handleSignIn}
            onShowToast={showToast}
          />
        ) : (
          <DashboardView
            feedbacks={feedbacks}
            isLoading={isLoadingFeedbacks}
            user={user}
            onSignIn={handleSignIn}
            onShowToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FeedbackHubApp />
    </ErrorBoundary>
  );
}
