import React from 'react';

/**
 * Bilingual loading / error early-return UI for Fact Book pages.
 */
export default function PageStatus({
  lang = 'en',
  loading = false,
  error = null,
  loadingMessage,
  className = '',
  style,
}) {
  if (loading) {
    const text =
      loadingMessage
      || (lang === 'fr' ? 'Chargement...' : 'Loading...');
    return (
      <div
        className={`page-status page-status--loading ${className}`.trim()}
        style={style}
        aria-busy="true"
      >
        <p>{text}</p>
      </div>
    );
  }

  if (error) {
    const message = typeof error === 'string'
      ? error
      : (error?.message || String(error));
    return (
      <div
        className={`page-status page-status--error ${className}`.trim()}
        style={style}
        role="alert"
      >
        <p>
          {lang === 'fr' ? 'Erreur : ' : 'Error: '}
          {message}
        </p>
      </div>
    );
  }

  return null;
}
