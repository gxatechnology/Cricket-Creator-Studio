import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AppRoute =
  | '/'
  | '/dashboard'
  | '/studio'
  | '/login'
  | '/get-started'
  | '/settings';

interface RouterContextValue {
  currentPath: string;
  navigate: (to: string, replace?: boolean) => void;
  params: Record<string, string>;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function normalizePath(raw: string): string {
  // Support hash routing fallback if deployed without SPA rewrite
  if (raw.includes('#/')) {
    const hashPart = raw.split('#')[1] || '/';
    return hashPart.split('?')[0] || '/';
  }
  const clean = raw.split('?')[0].split('#')[0] || '/';
  return clean === '' ? '/' : clean;
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return normalizePath(window.location.pathname + window.location.hash);
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname + window.location.hash));
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    if (typeof window === 'undefined') return;

    const normalized = normalizePath(to);
    if (replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    setCurrentPath(normalized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const params = useMemo<Record<string, string>>(() => {
    // Extract query params
    if (typeof window === 'undefined') return {};
    const search = window.location.search;
    const urlParams = new URLSearchParams(search);
    const result: Record<string, string> = {};
    urlParams.forEach((v, k) => {
      result[k] = v;
    });
    return result;
  }, [currentPath]);

  const value = useMemo(
    () => ({
      currentPath,
      navigate,
      params,
    }),
    [currentPath, navigate, params]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return ctx;
}

export function Link({
  to,
  children,
  className = '',
  onClick,
  ...rest
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  [key: string]: unknown;
}) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
}
