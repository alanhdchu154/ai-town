import Game from './components/Game.tsx';
import ConversationWall from './components/ConversationWall.tsx';

import { ToastContainer } from 'react-toastify';
import { useEffect, useState } from 'react';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';

export default function Home() {
  const [view, setView] = useState(() => currentView());
  useEffect(() => {
    const onPopState = () => setView(currentView());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const setRouteView = (nextView: 'world' | 'conversations') => {
    const url = new URL(window.location.href);
    if (nextView === 'world') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', nextView);
    }
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setView(nextView);
  };

  return (
    <main className="relative flex h-screen overflow-hidden flex-col items-center justify-between font-body game-background">
      <div className="w-full h-screen min-h-0 relative isolate overflow-hidden p-2 lg:p-3 flex flex-col justify-center items-center gap-3">
        <h1 className="sr-only">GIIS Underworld</h1>

        {view === 'conversations' ? (
          <ConversationWall onOpenWorld={() => setRouteView('world')} />
        ) : (
          <Game view={view} onChangeView={setRouteView} />
        )}
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
    </main>
  );
}

function currentView(): 'world' | 'conversations' {
  if (typeof window === 'undefined') return 'world';
  return new URLSearchParams(window.location.search).get('view') === 'conversations'
    ? 'conversations'
    : 'world';
}
