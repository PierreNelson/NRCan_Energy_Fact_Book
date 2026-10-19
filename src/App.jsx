import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import Layout from './components/Layout';
import { watchExportedData } from './utils/dataLoader';

const SectionOne = React.lazy(() => import('./components/SectionOne'));
const SectionTwo = React.lazy(() => import('./components/SectionTwo'));
const SectionThree = React.lazy(() => import('./components/SectionThree'));
const SectionFour = React.lazy(() => import('./components/SectionFour'));
const SectionFive = React.lazy(() => import('./components/SectionFive'));
const SectionSix = React.lazy(() => import('./components/SectionSix'));
const Glossary = React.lazy(() => import('./components/Glossary'));

const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

const LoadingSpinner = ({ lang = 'en' }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'white',
  }}>
    <div style={{
      textAlign: 'center',
      color: '#857550',
      fontFamily: "'Noto Sans', sans-serif",
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #857550',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px',
      }} />
      <p>{lang === 'fr' ? 'Chargement…' : 'Loading…'}</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

function AppRoutes() {
  const [searchParams] = useSearchParams();
  const embed = searchParams.get('embed') === '1';
  const [lang] = useState(() => {
    try {
      return localStorage.getItem('efb-lang') === 'fr' ? 'fr' : 'en';
    } catch {
      return 'en';
    }
  });

  return (
    <Routes>
      <Route path="/" element={<Layout embed={embed} />}>
        <Route index element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <SectionOne />
          </Suspense>
        } />
        <Route path="section-1" element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <SectionOne />
          </Suspense>
        } />
        <Route path="section-2" element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <SectionTwo />
          </Suspense>
        } />
        <Route path="section-3" element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <SectionThree />
          </Suspense>
        } />
        <Route path="section-4" element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <SectionFour />
          </Suspense>
        } />
        <Route path="section-5" element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <SectionFive />
          </Suspense>
        } />
        <Route path="section-6" element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <SectionSix />
          </Suspense>
        } />
        <Route path="Glossary" element={
          <Suspense fallback={<LoadingSpinner lang={lang} />}>
            <Glossary />
          </Suspense>
        } />
      </Route>
    </Routes>
  );
}

function App() {
  useEffect(() => {
    document.title = "Energy Fact Book | Livre de faits sur l'énergie";
    watchExportedData();
  }, []);

  return (
    <BrowserRouter basename={routerBasename}>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
