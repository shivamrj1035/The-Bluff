import { useEffect, useRef } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useGameStore } from '../../games/bluff/store/useGameStore';

function normalizeClerkUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email:
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    fullName: user.fullName || '',
    imageUrl: user.imageUrl || '',
    username: user.username || '',
  };
}

export default function ClerkSync() {
  const { isLoaded, isSignedIn, getToken, sessionId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const lastSyncedSession = useRef(null);

  useEffect(() => {
    const store = useGameStore.getState();

    if (!isLoaded) {
      store.setAuthLoading(true);
      return;
    }

    if (!isSignedIn || !user) {
      store.clearAuthState();
      return;
    }

    store.setAuthState({
      user: normalizeClerkUser(user),
      session: sessionId || null,
      getToken,
      signOut: () => clerk.signOut(),
    });
    if (lastSyncedSession.current !== sessionId) {
      lastSyncedSession.current = sessionId || null;
      store.fetchProfile();
    }
  }, [clerk, getToken, isLoaded, isSignedIn, sessionId, user]);

  return null;
}
