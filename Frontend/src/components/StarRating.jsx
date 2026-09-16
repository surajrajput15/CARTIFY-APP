import { Star } from 'lucide-react';

// Displays a 5-star scale for a numeric rating (0–5). The stars are purely
// decorative; the numeric value is rendered separately in an accessible label.
const StarRating = ({ rating = 0, size = 14, className = '' }) => {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const fullStars = Math.round(value);
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= fullStars ? 'fill-current text-yellow-400' : 'fill-current text-gray-200'}
        />
      ))}
    </div>
  );
};

export default StarRating;