// Empty state illustrations as inline SVG components
// Self-contained, no external dependencies, perfect crispness at any size

export const EmptyCartIllustration = ({ className = 'w-48 h-48' }) => (
  <svg
    className={className}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="100" cy="100" r="95" fill="#F3F4F6" />
    <path
      d="M55 65 L70 65 L82 130 L145 130 L155 80 L80 80"
      stroke="#0d9488"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M82 80 L155 80"
      stroke="#0d9488"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="90" cy="148" r="8" fill="#0d9488" />
    <circle cx="138" cy="148" r="8" fill="#0d9488" />
    <circle cx="90" cy="148" r="3" fill="#fff" />
    <circle cx="138" cy="148" r="3" fill="#fff" />
    <path
      d="M120 55 L135 45 L150 55 L150 75 L135 85 L120 75 Z"
      fill="#f59e0b"
      opacity="0.8"
    />
    <path
      d="M130 60 L130 75 M130 60 L140 60"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const EmptyOrdersIllustration = ({ className = 'w-48 h-48' }) => (
  <svg
    className={className}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="100" cy="100" r="95" fill="#F3F4F6" />
    <rect x="50" y="60" width="100" height="110" rx="6" fill="#fff" stroke="#0d9488" strokeWidth="3" />
    <rect x="50" y="60" width="100" height="20" rx="6" fill="#0d9488" />
    <rect x="60" y="92" width="80" height="6" rx="3" fill="#E5E7EB" />
    <rect x="60" y="106" width="60" height="6" rx="3" fill="#E5E7EB" />
    <rect x="60" y="120" width="70" height="6" rx="3" fill="#E5E7EB" />
    <rect x="60" y="140" width="40" height="20" rx="4" fill="#0d9488" />
    <circle cx="140" cy="55" r="18" fill="#f59e0b" />
    <path
      d="M140 47 L140 63 M132 55 L148 55"
      stroke="#fff"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export const EmptyProductsIllustration = ({ className = 'w-48 h-48' }) => (
  <svg
    className={className}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="100" cy="100" r="95" fill="#F3F4F6" />
    <rect x="55" y="70" width="90" height="100" rx="8" fill="#fff" stroke="#0d9488" strokeWidth="3" />
    <rect x="68" y="85" width="64" height="8" rx="4" fill="#E5E7EB" />
    <rect x="68" y="100" width="44" height="8" rx="4" fill="#E5E7EB" />
    <rect x="68" y="120" width="32" height="32" rx="4" fill="#0d9488" />
    <circle cx="140" cy="60" r="16" fill="#f59e0b" />
    <path
      d="M140 54 L140 66 M134 60 L146 60"
      stroke="#fff"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const SearchEmptyIllustration = ({ className = 'w-32 h-32' }) => (
  <svg
    className={className}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="48" cy="48" r="30" fill="#F3F4F6" />
    <circle cx="48" cy="48" r="20" stroke="#9ca3af" strokeWidth="4" fill="none" />
    <line x1="62" y1="62" x2="78" y2="78" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
    <line x1="40" y1="40" x2="56" y2="56" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const NotFoundIllustration = ({ className = 'w-48 h-48' }) => (
  <svg
    className={className}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="100" cy="100" r="95" fill="#F3F4F6" />
    <text
      x="100"
      y="118"
      textAnchor="middle"
      fontSize="72"
      fontWeight="900"
      fill="#0d9488"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      404
    </text>
    <circle cx="60" cy="60" r="6" fill="#f59e0b" />
    <circle cx="140" cy="60" r="6" fill="#0d9488" />
    <path
      d="M40 150 Q100 165 160 150"
      stroke="#9ca3af"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

export const ErrorIllustration = ({ className = 'w-32 h-32' }) => (
  <svg
    className={className}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="60" cy="60" r="50" fill="#FEE2E2" />
    <path
      d="M60 30 L60 65 M60 75 L60 80"
      stroke="#ef4444"
      strokeWidth="6"
      strokeLinecap="round"
    />
  </svg>
);

export const SuccessIllustration = ({ className = 'w-32 h-32' }) => (
  <svg
    className={className}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="60" cy="60" r="50" fill="#D1FAE5" />
    <path
      d="M40 60 L55 75 L82 45"
      stroke="#10b981"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const HeroIllustration = ({ className = 'w-full h-60 md:h-72' }) => (
  <svg
    className={className}
    viewBox="0 0 400 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0d9488" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#heroGradient)" rx="16" />

    {/* Shopping bag */}
    <g transform="translate(140, 80)">
      <path
        d="M20 40 L20 145 Q20 160 35 160 L85 160 Q100 160 100 145 L100 40 Z"
        fill="#fff"
        stroke="#0d9488"
        strokeWidth="3"
      />
      <path
        d="M40 40 Q40 20 60 20 Q80 20 80 40"
        stroke="#0d9488"
        strokeWidth="3"
        fill="none"
      />
      <circle cx="60" cy="100" r="8" fill="#f59e0b" />
      <path
        d="M55 100 L60 105 L70 95"
        stroke="#fff"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </g>

    {/* Floating product icons */}
    <g transform="translate(60, 100)" opacity="0.9">
      <rect width="40" height="40" rx="8" fill="#fff" stroke="#0d9488" strokeWidth="2" />
      <rect x="8" y="12" width="24" height="16" rx="2" fill="#f59e0b" />
    </g>
    <g transform="translate(290, 130)" opacity="0.9">
      <rect width="40" height="40" rx="8" fill="#fff" stroke="#0d9488" strokeWidth="2" />
      <circle cx="20" cy="20" r="10" fill="#10b981" />
    </g>
    <g transform="translate(310, 60)" opacity="0.9">
      <rect width="40" height="40" rx="8" fill="#fff" stroke="#0d9488" strokeWidth="2" />
      <path d="M10 20 L20 10 L30 20 L20 30 Z" fill="#ec4899" />
    </g>

    {/* Sparkles */}
    <g fill="#f59e0b">
      <circle cx="50" cy="50" r="2" />
      <circle cx="350" cy="200" r="2" />
      <circle cx="80" cy="220" r="1.5" />
      <circle cx="340" cy="40" r="1.5" />
    </g>
  </svg>
);