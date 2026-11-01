import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaStore {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  install: () => Promise<boolean>;
}

export const usePwa = create<PwaStore>((set, get) => ({
  deferred: null,
  installed: typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches,
  install: async () => {
    const d = get().deferred;
    if (!d) return false;
    await d.prompt();
    const res = await d.userChoice;
    set({ deferred: null, installed: res.outcome === 'accepted' });
    return res.outcome === 'accepted';
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwa.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwa.setState({ installed: true, deferred: null }));
}
