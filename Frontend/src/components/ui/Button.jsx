/**
 * F-28 — shared button primitive.
 *
 * Only the CTA colour pairs live here (the tokens that were repeated inline
 * across ~40 files). Everything site-specific (padding, radius, width,
 * disabled:* tweaks) stays in the caller's className, so migrating a screen
 * is a pure token extraction with zero visual change.
 */
const VARIANTS = {
  teal: 'bg-teal-600 text-white hover:bg-teal-700',
  dark: 'bg-gray-900 text-white hover:bg-teal-600',
  none: '',
};

export default function Button({ variant = 'teal', className = '', type, ...rest }) {
  // `type` is destructured so an omitted prop stays omitted (HTML default
  // behaviour is preserved); explicit type="submit" / "button" passes through.
  return (
    <button
      type={type}
      className={`${VARIANTS[variant] || ''} ${className}`.trim()}
      {...rest}
    />
  );
}
