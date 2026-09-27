import { SearchEmptyIllustration } from './illustrations/EmptyStateIllustrations';
import Button from './ui/Button';
import Card from './ui/Card';

const EmptyState = ({ message, onClearFilters }) => (
  <Card className="rounded-2xl border py-12 sm:py-16 px-4 text-center">
    <SearchEmptyIllustration className="mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-3" />
    <h3 className="text-base sm:text-lg font-bold text-gray-600 mb-1">No products found</h3>
    <p className="text-sm text-gray-500 max-w-xs mx-auto">{message}</p>
    {onClearFilters && (
      <Button
        onClick={onClearFilters}
        className="mt-5 inline-flex items-center px-5 py-2.5 rounded-lg font-bold transition-colors min-h-[44px]"
      >
        Clear all filters
      </Button>
    )}
  </Card>
);

export default EmptyState;