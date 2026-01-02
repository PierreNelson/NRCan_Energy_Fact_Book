
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy load pages for code splitting
// These files are NOT downloaded initially - only when user navigates to them
const Page23 = React.lazy(() => import('./pages/Page23'));
const Page24 = React.lazy(() => import('./pages/Page24'));
const Page25 = React.lazy(() => import('./pages/Page25'));
const Page26 = React.lazy(() => import('./pages/Page26'));
const Page27 = React.lazy(() => import('./pages/Page27'));

// Loading component for Suspense fallback
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: 'white'
  }}>
    <div style={{
      textAlign: 'center',
      color: '#857550',
      fontFamily: 'Georgia, serif'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #857550',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px'
      }} />
      <p>Loading...</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Wrap routes in Suspense for lazy loading */}
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <Page23 />
            </Suspense>
          } />
          <Route path="page-24" element={
            <Suspense fallback={<LoadingSpinner />}>
              <Page24 />
            </Suspense>
          } />
          <Route path="page-25" element={
            <Suspense fallback={<LoadingSpinner />}>
              <Page25 />
            </Suspense>
          } />
          <Route path="page-26" element={
            <Suspense fallback={<LoadingSpinner />}>
              <Page26 />
            </Suspense>
          } />
          <Route path="page-27" element={
            <Suspense fallback={<LoadingSpinner />}>
              <Page27 />
            </Suspense>
          } />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
