import React from 'react';

/**
 * Fact Book gray "Clear selection" control for Plotly chart multi-select.
 */
export default function ClearSelectionButton({
  lang = 'en',
  onClick,
  label,
  className = '',
}) {
  const text =
    label
    || (lang === 'fr' ? 'Effacer la sélection' : 'Clear selection');

  return (
    <div className={`clear-selection ${className}`.trim()}>
      <button
        type="button"
        className="clear-selection__button"
        onClick={onClick}
      >
        {text}
      </button>
    </div>
  );
}
