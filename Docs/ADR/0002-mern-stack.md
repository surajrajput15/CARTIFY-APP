# ADR 0002: MERN Stack with Serverless Deployment

## Status
Accepted

## Date
2026-01-15

## Context
Cartify is a full-stack e-commerce platform. We need to choose a technology stack that:
- Supports rapid development
- Can scale to handle production traffic
- Has good developer experience
- Minimizes infrastructure costs
- Supports a modern feature set (real-time updates, PWA, mobile-responsive)

## Decision
Use the MERN stack (MongoDB, Express, React, Node.js) with serverless deployment:

- **Frontend**: React 19 + Vite 8, deployed on Vercel
- **Backend**: Node.js 18 + Express 4, deployed on Render
- **Database**: MongoDB Atlas (managed)
- **CDN/Images**: Cloudinary
- **Email**: Brevo HTTP API
- **Payments**: Razorpay

## Consequences

### Positive
- Single language (JavaScript/TypeScript) across the stack
- React 19's concurrent features improve UX
- Vite 8 provides instant HMR and fast builds
- Serverless deployment means zero infrastructure management
- Vercel/Render free tiers cover development costs
- MongoDB Atlas handles backups, scaling, monitoring
- Excellent ecosystem of packages and tools

### Negative
- Cold starts on serverless (mitigated by Render's always-on instances)
- MongoDB requires careful schema design (no enforced relationships)
- JavaScript everywhere means easier to share bugs
- Vendor lock-in for managed services

### Mitigations
- Use Mongoose for schema validation
- Implement proper error boundaries and graceful shutdown
- Use multi-environment setup (staging + production)
- Document migration paths for all services

## Alternatives Considered

1. **Next.js full-stack**: More integrated but less flexibility in backend architecture
2. **Django + React**: Two different languages increases context switching
3. **Firebase + React**: Vendor lock-in, harder to migrate
4. **AWS Amplify**: More complex setup, higher cost

## References
- [React Documentation](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)
- [Vercel Documentation](https://vercel.com/docs)