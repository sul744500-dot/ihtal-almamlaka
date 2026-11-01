import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toasts } from './components/ui';
import { Home } from './pages/Home';

const NewMatch = lazy(() => import('./pages/NewMatch').then((m) => ({ default: m.NewMatch })));
const TeamsSetup = lazy(() => import('./pages/TeamsSetup').then((m) => ({ default: m.TeamsSetup })));
const CategoriesSetup = lazy(() => import('./pages/CategoriesSetup').then((m) => ({ default: m.CategoriesSetup })));
const Play = lazy(() => import('./pages/Play').then((m) => ({ default: m.Play })));
const Host = lazy(() => import('./pages/Host').then((m) => ({ default: m.Host })));
const Audience = lazy(() => import('./pages/Audience').then((m) => ({ default: m.Audience })));
const Editor = lazy(() => import('./pages/Editor').then((m) => ({ default: m.Editor })));
const Results = lazy(() => import('./pages/Results').then((m) => ({ default: m.Results })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));

function Loading() {
  return <div className="flex h-full items-center justify-center text-xl text-gold-200">جارٍ التحميل…</div>;
}

export function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewMatch />} />
          <Route path="/new/teams" element={<TeamsSetup />} />
          <Route path="/new/categories" element={<CategoriesSetup />} />
          <Route path="/play" element={<Play />} />
          <Route path="/host" element={<Host />} />
          <Route path="/audience" element={<Audience />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <Toasts />
    </HashRouter>
  );
}
