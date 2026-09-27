import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';
import Card from './Card';
import Input from './Input';
import Badge from './Badge';

describe('ui/Button (F-28)', () => {
  it('renders a real <button> with the teal CTA tokens', () => {
    render(<Button variant="teal">Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toContain('bg-teal-600');
    expect(btn.className).toContain('text-white');
    expect(btn.className).toContain('hover:bg-teal-700');
  });

  it('renders the dark CTA variant', () => {
    render(<Button variant="dark">Pay</Button>);
    const btn = screen.getByRole('button', { name: 'Pay' });
    expect(btn.className).toContain('bg-gray-900');
    expect(btn.className).toContain('hover:bg-teal-600');
  });

  it('merges variant tokens with caller className and forwards props', () => {
    const onClick = vi.fn();
    render(
      <Button variant="teal" type="submit" disabled className="w-full min-h-[44px]" onClick={onClick}>
        Go
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.className).toContain('bg-teal-600');
    expect(btn.className).toContain('w-full');
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.type).toBe('submit');
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('omits type when not provided (HTML default preserved)', () => {
    render(<Button variant="teal">X</Button>);
    expect(screen.getByRole('button', { name: 'X' }).type).toBe('submit');
  });

  it('variant="none" contributes no colour tokens', () => {
    render(<Button variant="none" className="text-gray-600">Plain</Button>);
    const cls = screen.getByRole('button', { name: 'Plain' }).className;
    expect(cls).not.toContain('bg-teal-600');
    expect(cls).toContain('text-gray-600');
  });
});

describe('ui/Card (F-28)', () => {
  it('applies the surface tokens and keeps caller layout classes', () => {
    render(<Card className="rounded-xl p-6">Body</Card>);
    const card = screen.getByText('Body');
    expect(card.tagName).toBe('DIV');
    expect(card.className).toContain('bg-white');
    expect(card.className).toContain('shadow-sm');
    expect(card.className).toContain('border');
    expect(card.className).toContain('border-gray-100');
    expect(card.className).toContain('rounded-xl');
    expect(card.className).toContain('p-6');
  });
});

describe('ui/Input (F-28)', () => {
  it('applies border + focus tokens and forwards input props', () => {
    render(<Input aria-label="Email" placeholder="a@b.c" className="w-full px-4 py-3" />);
    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input.className).toContain('border');
    expect(input.className).toContain('focus:ring-teal-500');
    expect(input.className).toContain('focus:border-teal-500');
    expect(input.className).toContain('w-full');
    expect(input.placeholder).toBe('a@b.c');
  });
});

describe('ui/Badge (F-28)', () => {
  it('renders a span with the variant colour pair', () => {
    render(<Badge variant="success" className="px-2 py-0.5 rounded-full text-xs">OK</Badge>);
    const badge = screen.getByText('OK');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-700');
    expect(badge.className).toContain('rounded-full');
  });

  it('supports the soft (50-tint) variants distinctly', () => {
    render(<Badge variant="dangerSoft">Fail</Badge>);
    const badge = screen.getByText('Fail');
    expect(badge.className).toContain('bg-red-50');
    expect(badge.className).toContain('text-red-700');
  });
});
