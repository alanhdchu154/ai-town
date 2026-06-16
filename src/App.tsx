import Game from './components/Game.tsx';
import ConversationWall from './components/ConversationWall.tsx';

import { ToastContainer } from 'react-toastify';
import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
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

        <AppErrorBoundary key={view}>
          {view === 'conversations' ? (
            <ConversationWall onOpenWorld={() => setRouteView('world')} />
          ) : (
            <Game view={view} onChangeView={setRouteView} />
          )}
        </AppErrorBoundary>
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
    </main>
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GIIS UI boundary]', error, info);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="mx-auto flex min-h-[28rem] w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-2xl border border-violet-300/30 bg-slate-950/90 p-6 text-center text-slate-100 shadow-2xl shadow-violet-950/30">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200/70">
            GIIS Underworld
          </p>
          <h2 className="mt-2 text-2xl font-bold">校園正在重新連線</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            剛剛有一段資料沒有接上。先別急，Alan，我們讓畫面重新抓一次世界狀態。
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button className="giis-action-pill giis-action-pill-primary" onClick={this.retry}>
            再試一次
          </button>
          <button className="giis-action-pill" onClick={() => window.location.reload()}>
            重新整理
          </button>
        </div>
      </section>
    );
  }
}

function currentView(): 'world' | 'conversations' {
  if (typeof window === 'undefined') return 'world';
  return new URLSearchParams(window.location.search).get('view') === 'conversations'
    ? 'conversations'
    : 'world';
}
