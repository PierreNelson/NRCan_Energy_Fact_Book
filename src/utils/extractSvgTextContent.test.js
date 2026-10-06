import { describe, it, expect } from 'vitest';
import { extractSvgTextContent } from './extractSvgTextContent.js';

describe('extractSvgTextContent', () => {
  it('joins text and tspan content in order', () => {
    const markup = `
      <svg>
        <text>Exports <tspan>90%</tspan></text>
        <text>Imports <tspan>10%</tspan></text>
      </svg>`;
    expect(extractSvgTextContent(markup)).toBe('Exports 90%. Imports 10%');
  });

  it('keeps multi-tspan list items as one phrase', () => {
    const markup = `
      <svg>
        <text><tspan>Natural Resources</tspan><tspan>Canada</tspan></text>
        <text>Energy regulators</text>
      </svg>`;
    expect(extractSvgTextContent(markup)).toBe('Natural Resources Canada. Energy regulators');
  });

  it('joins line breaks with a space when asked', () => {
    const markup = `
      <svg>
        <text>Biomass</text>
        <text>accounts for the</text>
        <text>, at</text>
        <text>46%.</text>
      </svg>`;
    expect(extractSvgTextContent(markup, { separator: ' ' })).toBe('Biomass accounts for the, at 46%.');
  });

  it('returns empty string when there is no text', () => {
    expect(extractSvgTextContent('<svg><path d="M0 0"/></svg>')).toBe('');
  });
});
