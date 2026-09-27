/**
 * F-28 — shared input primitive.
 *
 * Base = the border + focus-ring tokens every form field shared
 * (border width, teal focus ring). Padding/width/radius/text styles vary
 * heavily between screens (p-3 vs px-4 py-2.5 vs pl-10 pr-3 py-4,
 * rounded-lg vs rounded-xl) and stay in the caller's className so the
 * migrated markup renders pixel-identically.
 */
export default function Input({ className = '', type, ...rest }) {
  return (
    <input
      type={type}
      className={`border focus:ring-teal-500 focus:border-teal-500 ${className}`.trim()}
      {...rest}
    />
  );
}
