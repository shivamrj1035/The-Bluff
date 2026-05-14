import { useEffect } from 'react';
import { useClerk } from '@clerk/clerk-react';

export default function AuthDialog({ isOpen, onClose }) {
  const clerk = useClerk();

  useEffect(() => {
    if (!isOpen) return undefined;

    clerk.openSignIn({});
    onClose?.();
    return undefined;
  }, [clerk, isOpen, onClose]);

  return null;
}
