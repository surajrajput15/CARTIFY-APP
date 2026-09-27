// F-42: axe-core a11y gate helper for vitest + jsdom.
// Usage:  const violations = await getViolations(container);
//         expect(formatSerious(violations)).toBe('');
import axe from 'axe-core';

// jsdom cannot compute rendered colours, so `color-contrast` would report
// noise instead of truth. Contrast was audited manually (Wave A/B, F-23/F-24).
const RUN_OPTIONS = {
  resultTypes: ['violations'],
  rules: {
    'color-contrast': { enabled: false },
  },
};

export const getViolations = async (container, options = {}) => {
  const results = await axe.run(container, { ...RUN_OPTIONS, ...options });
  return results.violations;
};

// The pipeline gate is: no serious/critical violations anywhere.
export const seriousViolations = (violations) =>
  violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

export const formatViolations = (violations) =>
  violations
    .map(
      (v) =>
        `${v.impact}: ${v.id} — ${v.help}\n    ${v.nodes
          .map((n) => n.target.join(' '))
          .join('\n    ')}`
    )
    .join('\n');
