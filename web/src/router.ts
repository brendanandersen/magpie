import { useEffect, useState } from 'react';

/** The top-level screens of the app, in wizard order. */
export type Route = 'generate' | 'customize' | 'language';

/** Read the current route from the URL hash (search params carry seed/style). */
export function currentRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/language')) return 'language';
  if (hash.startsWith('/customize')) return 'customize';
  return 'generate';
}

/** Navigate to a route by updating the hash, preserving the query string. */
export function navigate(route: Route): void {
  const target = route === 'language' ? '#/language' : route === 'customize' ? '#/customize' : '#/';
  if (window.location.hash !== target) window.location.hash = target;
}

/** Subscribe to hash changes and return the current route. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
