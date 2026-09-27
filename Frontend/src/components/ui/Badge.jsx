/**
 * F-28 — shared badge primitive.
 *
 * Variant carries only the exact colour pair used at the call site (the
 * map deliberately keeps green-50 and green-100 variants distinct so a
 * migration never shifts a tint). Shape (px/py/rounded-full/text size,
 * borders) stays with the caller.
 */
const VARIANTS = {
  success: 'bg-green-100 text-green-700',
  successSoft: 'bg-green-50 text-green-700',
  danger: 'bg-red-100 text-red-700',
  dangerSoft: 'bg-red-50 text-red-700',
  info: 'bg-teal-50 text-teal-700',
  neutral: 'bg-gray-100 text-gray-600',
  none: '',
};

export default function Badge({ variant = 'neutral', className = '', ...rest }) {
  return (
    <span
      className={`${VARIANTS[variant] || ''} ${className}`.trim()}
      {...rest}
    />
  );
}
