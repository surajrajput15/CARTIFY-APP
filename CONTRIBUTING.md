# Contributing to Cartify

Thank you for your interest in contributing to Cartify! This document provides guidelines and best practices for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow the project's coding standards

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (local or Atlas)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/surajrajput999/CARTIFY-APP.git
cd CARTIFY-APP

# Install dependencies
cd Frontend && npm install
cd ../Backend && npm install

# Set up environment variables
cp Frontend/.env.example Frontend/.env
cp Backend/.env.example Backend/.env

# Start development servers
# Terminal 1 - Backend
cd Backend && npm run dev

# Terminal 2 - Frontend
cd Frontend && npm run dev
```

### Project Structure

```
CARTIFY-APP/
├── Frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── api/          # Axios config
│   │   ├── components/   # Reusable components
│   │   ├── context/      # React contexts (Auth, Cart)
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Page components
│   │   ├── services/      # API service modules
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   └── tests/             # E2E tests
├── Backend/               # Node.js + Express backend
│   ├── migrations/        # Database migrations
│   ├── models/            # Mongoose models
│   ├── routes/            # Express routes
│   ├── middleware/        # Custom middleware
│   ├── utils/             # Utility functions
│   └── __tests__/          # Unit/integration tests
├── Docs/                  # Documentation
│   ├── ADR/               # Architecture Decision Records
│   ├── *.md              # Other documentation
└── .github/               # GitHub Actions
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add product image optimization
fix: resolve cart sync race condition
docs: update deployment runbook
style: format code with prettier
refactor: extract user service
test: add unit tests for cart context
chore: update dependencies
```

### Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes with clear commit messages
3. Write/update tests for your changes
4. Run all tests locally:
   ```bash
   cd Backend && npm test
   cd Frontend && npm test
   ```
5. Run lint:
   ```bash
   cd Frontend && npm run lint
   cd Backend && npm run lint
   ```
6. Update documentation if needed
7. Push and create a PR
8. Request review from a team member
9. Address review feedback
10. Squash merge after approval

## Code Review Checklist

### Security

- [ ] No secrets in code (use environment variables)
- [ ] Input validation on all user inputs
- [ ] Authentication/authorization checks on protected routes
- [ ] No SQL/NoSQL injection vulnerabilities
- [ ] XSS protection in place
- [ ] CSRF protection for state-changing operations
- [ ] Rate limiting on sensitive endpoints

### Performance

- [ ] No N+1 database queries
- [ ] Database indexes for new query patterns
- [ ] Caching where appropriate
- [ ] Bundle size impact assessed
- [ ] No memory leaks (cleanup in useEffect)
- [ ] Optimistic UI updates where appropriate

### Code Quality

- [ ] Code follows existing patterns
- [ ] No console.log in production code
- [ ] No commented-out code
- [ ] No unused imports/variables
- [ ] Meaningful variable and function names
- [ ] Functions are small and focused
- [ ] No magic numbers (use constants)
- [ ] Proper error handling

### Testing

- [ ] Unit tests for new functionality
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical user flows
- [ ] Edge cases covered
- [ ] Tests are deterministic
- [ ] Coverage meets thresholds (70% BE, 60% FE)

### Accessibility

- [ ] Semantic HTML used
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Screen reader friendly
- [ ] Form labels associated

### Documentation

- [ ] JSDoc for public APIs
- [ ] README updated if needed
- [ ] CHANGELOG updated
- [ ] Inline comments for complex logic
- [ ] API documentation updated

## Testing Guidelines

### Backend Tests

```javascript
// Example: Testing an auth route
describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Password123' });
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
  
  it('should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });
    
    expect(res.status).toBe(400);
  });
});
```

### Frontend Tests

```javascript
// Example: Testing a component
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProductCard from './ProductCard';

describe('ProductCard', () => {
  it('renders product title and price', () => {
    const product = { _id: '1', title: 'Test', price: 100, image: 'x.jpg' };
    render(<ProductCard product={product} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('₹100')).toBeInTheDocument();
  });
});
```

## Style Guide

### JavaScript/TypeScript

- Use ES modules (`import`/`export`)
- Use `const` by default, `let` only when reassignment is needed
- Never use `var`
- Use arrow functions for callbacks
- Use template literals for string interpolation
- Use destructuring for object/array access
- Use async/await over promise chains

### React

- Use functional components with hooks
- Use `React.memo` for expensive components
- Use `useCallback` for event handlers passed to children
- Use `useMemo` for expensive computations
- Avoid prop drilling — use context or state management
- Co-locate related files (component + styles + tests)

### CSS

- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Use semantic class names for custom CSS
- Avoid inline styles
- Use CSS variables for theming

### Naming Conventions

- **Files**: `PascalCase` for components, `camelCase` for utilities
- **Components**: `PascalCase` (e.g., `ProductCard`)
- **Functions**: `camelCase` (e.g., `fetchProducts`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_QUANTITY`)
- **CSS Classes**: Tailwind utilities preferred
- **Database**: `camelCase` for fields, `PascalCase` for models

## Adding Dependencies

Before adding a new dependency:

1. Check if functionality exists in current dependencies
2. Evaluate alternatives
3. Consider bundle size impact
4. Check license compatibility
5. Update package.json
6. Document why it was added in PR

## Reporting Bugs

Use GitHub Issues with:

1. **Clear title** describing the issue
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshots/videos** (if applicable)
6. **Environment** (browser, OS, versions)
7. **Console errors** (from browser dev tools)

## Feature Requests

Use GitHub Issues with:

1. **Problem statement** - what problem does this solve?
2. **Proposed solution** - how should it work?
3. **Alternatives considered** - what else was considered?
4. **Impact** - who benefits and how?

## Release Process

1. Update `CHANGELOG.md` with all changes
2. Bump version in `package.json` files
3. Create a release branch
4. Run full test suite
5. Tag the release
6. Deploy to production
7. Announce in team channel

## Questions?

- Open a GitHub Discussion
- Check existing documentation
- Ask in team chat
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the ISC License.