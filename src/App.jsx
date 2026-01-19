
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy load section wrappers for code splitting
// These files are NOT downloaded initially - only when user navigates to them
const SectionOne = React.lazy(() => import('./components/SectionOne'));
const SectionTwo = React.lazy(() => import('./components/SectionTwo'));

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
          {/* Section 1: Energy Factbook Introduction (Page 1) */}
          <Route index element={
            <Suspense fallback={<LoadingSpinner />}>
              <SectionOne />
            </Suspense>
          } />
          <Route path="section-1" element={
            <Suspense fallback={<LoadingSpinner />}>
              <SectionOne />
            </Suspense>
          } />
          
          {/* Section 2: Energy & Infrastructure (Pages 23, 24, 25, 26, 27, 31, 32, 37) */}
          <Route path="section-2" element={
            <Suspense fallback={<LoadingSpinner />}>
              <SectionTwo />
            </Suspense>
          } />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
