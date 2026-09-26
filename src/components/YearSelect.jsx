import React, { useEffect, useRef, useState } from 'react';

/**
 * Fact Book year dropdown — stacked label + bordered toggle + radio-style list
 * (matches NominalGdp / Economic contributions chrome).
 */
export default function YearSelect({
  lang = 'en',
  label,
  years = [],
  value,
  onChange,
  id = 'year-select',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  const resolvedLabel = label
    || (lang === 'fr' ? 'Sélectionner l\'année :' : 'Select year:');

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`year-select ${className}`.trim()}
    >
      <label htmlFor={id} className="year-select__label">
        {resolvedLabel}
      </label>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        className="year-select__button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{value}</span>
        <span className="year-select__caret" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="year-select__list" role="listbox" aria-labelledby={id}>
          {years.map((year) => {
            const isSelected = year === value;
            return (
              <button
                key={year}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-pressed={isSelected}
                aria-label={String(year)}
                className={`year-select__option${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange?.(year);
                  setOpen(false);
                  setTimeout(() => buttonRef.current?.focus(), 0);
                }}
              >
                <span className="year-select__radio" aria-hidden="true">
                  {isSelected ? <span className="year-select__radio-dot" /> : null}
                </span>
                <span className="year-select__option-label">{year}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
