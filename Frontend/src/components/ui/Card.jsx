/**
 * F-28 — shared card primitive.
 *
 * Base = the surface tokens that appeared on every card-style panel
 * (bg-white + shadow-sm + hairline border). Radius and padding are
 * deliberately NOT part of the base — screens use both rounded-xl and
 * rounded-2xl, so callers keep their own `rounded-*` + spacing classes.
 */
export default function Card({ className = '', ...rest }) {
  return (
    <div
      className={`bg-white shadow-sm border border-gray-100 ${className}`.trim()}
      {...rest}
    />
  );
}
