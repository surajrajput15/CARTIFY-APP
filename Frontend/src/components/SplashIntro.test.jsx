import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SplashIntro from './SplashIntro';

describe('SplashIntro', () => {
  it('shows the brand wordmark, tagline and project message', () => {
    render(<SplashIntro />);
    expect(screen.getByRole('heading', { name: /cartify/i })).toBeInTheDocument();
    expect(screen.getByText('Your Modern Shopping Experience')).toBeInTheDocument();
    expect(screen.getByText('Shop. Manage. Track. Delivered.')).toBeInTheDocument();
  });

  // Spec: no manual click required anywhere in the intro — not even an
  // optional skip affordance.
  it('renders zero interactive elements', () => {
    const { container } = render(<SplashIntro />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('marks floating icons as decorative', () => {
    const { container } = render(<SplashIntro />);
    const decorative = container.querySelectorAll('[aria-hidden="true"]');
    // One glow layer + one wrapper per floating icon.
    expect(decorative.length).toBeGreaterThanOrEqual(8);
  });

  it('applies the exit animation class only while exiting', () => {
    const { container, rerender } = render(<SplashIntro />);
    expect(container.firstChild.className).toContain('intro-veil');
    expect(container.firstChild.className).not.toContain('intro-exit');

    rerender(<SplashIntro exiting />);
    expect(container.firstChild.className).toContain('intro-exit');
  });

  it('uses a full-screen fixed layer above the app', () => {
    const { container } = render(<SplashIntro />);
    const classes = container.firstChild.className;
    expect(classes).toContain('fixed');
    expect(classes).toContain('inset-0');
    expect(classes).toContain('z-[100]');
  });
});
