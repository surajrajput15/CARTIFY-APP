# Deployment Runbook

## Overview

This document describes the deployment process for Cartify, including frontend (Vercel), backend (Render), and database (MongoDB Atlas).

## Environments

| Environment | Frontend URL | Backend URL | Database |
|-------------|--------------|-------------|----------|
| Production | https://cartify-hub.vercel.app | https://cartify-api-10g3.onrender.com | MongoDB Atlas (prod) |
| Staging | https://cartify-staging.vercel.app | https://cartify-api-staging.onrender.com | MongoDB Atlas (staging) |

## Pre-Deployment Checklist

- [ ] All tests pass (`npm test` in both `Frontend/` and `Backend/`)
- [ ] No console.log / console.error in production code
- [ ] Environment variables are configured in deployment platform
- [ ] Database migrations are applied (`npm run migrate:up` in `Backend/`)
- [ ] Security audit: no secrets in code
- [ ] Performance: bundle size check via `npm run build` and stats.html
- [ ] Accessibility: axe-core scan passes
- [ ] CHANGELOG.md updated

## Backend Deployment (Render)

### Initial Setup

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure:
   - **Root Directory**: `Backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

### Environment Variables

Set the following in Render's Environment tab:

| Variable | Value | Sensitive |
|----------|-------|-----------|
| `NODE_ENV` | `production` | No |
| `PORT` | `5000` (auto) | No |
| `MONGO_URI` | `mongodb+srv://...` | Yes |
| `JWT_SECRET` | 32+ random bytes hex | Yes |
| `RAZORPAY_KEY_ID` | `rzp_live_...` | Yes |
| `RAZORPAY_KEY_SECRET` | `rzp_live_...` | Yes |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | Yes |
| `BREVO_API_KEY` | From Brevo dashboard | Yes |
| `SENTRY_DSN` | From Sentry | Yes |
| `REDIS_URL` | `redis://...` (if using Redis) | Yes |
| `LOG_LEVEL` | `info` | No |

### Deployment Steps

```bash
# 1. Apply database migrations
npm run migrate:up

# 2. Deploy via Git push (auto-deploy on Render)
git push origin main

# 3. Verify health
curl https://cartify-api-10g3.onrender.com/health
# Expected: {"status":"ok","timestamp":"..."}

# 4. Verify readiness
curl https://cartify-api-10g3.onrender.com/ready
# Expected: {"status":"ready","timestamp":"..."}
```

### Rollback

1. Go to Render dashboard → Deploys
2. Find the last working deploy
3. Click "Rollback to this deploy"
4. Verify the rollback is healthy

## Frontend Deployment (Vercel)

### Initial Setup

1. Import project to Vercel
2. Configure:
   - **Root Directory**: `Frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Environment Variables

| Variable | Value | Sensitive |
|----------|-------|-----------|
| `VITE_API_URL` | `https://cartify-api-10g3.onrender.com/api/v1` | No |
| `VITE_RAZORPAY_KEY` | `rzp_live_...` | Yes |
| `VITE_GOOGLE_CLIENT_ID` | From Google Cloud Console | Yes |
| `VITE_SENTRY_DSN` | From Sentry | Yes |

### Deployment Steps

```bash
# 1. Deploy via Vercel CLI
vercel --prod

# 2. Verify deployment
curl -I https://cartify-hub.vercel.app
# Expected: 200 OK
```

### Rollback

1. Go to Vercel dashboard → Deployments
2. Find the last working deployment
3. Click "Promote to Production"

## Database Migrations

```bash
# Create new migration
npx migrate-mongo create add-new-indexes

# Apply migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check status
npm run migrate:status
```

## Rollback Procedure

### Full Rollback (Critical Issues)

1. **Pause deployments** in CI/CD
2. **Roll back backend** to last working deploy (Render dashboard)
3. **Roll back frontend** to last working deploy (Vercel dashboard)
4. **Roll back database** if needed:
   ```bash
   mongorestore --uri="$MONGO_URI_BACKUP" --drop dump/
   ```
5. **Verify all services** are healthy
6. **Communicate** status to team

### Partial Rollback (Frontend Only)

1. Revert last commit in `Frontend/`
2. Push to trigger auto-deploy
3. Monitor error rates in Sentry

### Partial Rollback (Backend Only)

1. Revert last commit in `Backend/`
2. Push to trigger auto-deploy
3. Check API health endpoint

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 | Service down | < 15 min |
| P1 | Major feature broken | < 1 hour |
| P2 | Minor issue | < 4 hours |
| P3 | Cosmetic issue | Next sprint |

### Monitoring

- **Sentry**: Error tracking and alerting
- **Render Metrics**: CPU, memory, response times
- **Vercel Analytics**: Web vitals, deployment status
- **Uptime monitoring**: `/health` and `/ready` endpoints

### On-Call

1. Check Sentry for error spikes
2. Check `/health` and `/ready` endpoints
3. Check Render/Vercel dashboards for build failures
4. Review recent deploys for suspect changes
5. Rollback if needed

## Post-Deployment

1. **Smoke test** all critical user flows
2. **Monitor** Sentry for new errors
3. **Check** Core Web Vitals in Vercel Analytics
4. **Verify** payments still process (Razorpay)
5. **Update** CHANGELOG.md
6. **Notify** team of successful deployment

## Security Considerations

- Never commit secrets to git
- Rotate secrets every 90 days
- Use environment variables in deployment platforms
- Enable 2FA on Vercel, Render, MongoDB Atlas, Sentry
- Review access logs monthly

## Common Issues & Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `ERR_CONNECTION_REFUSED` / `ECONNREFUSED` / `Network Error` | Backend server not running | Run `cd Backend && npm run dev` |
| `Failed to load products` / `Failed to fetch orders` | Backend down or wrong `VITE_API_URL` | Check backend is running; verify `VITE_API_URL` in `Frontend/.env` |
| `The given origin is not allowed for the given client ID` | Google OAuth origin not authorized | Add `http://localhost:5173` (or your dev port) to **Authorized JavaScript origins** in Google Cloud Console |
| `403 Forbidden` on Google Sign-In | Origin not whitelisted | Same as above — add your dev URL to Google Cloud Console |
| `MongoDB connection failed` | Wrong `MONGO_URI` or network blocked | Check `MONGO_URI` in `Backend/.env`; ensure IP is whitelisted in Atlas |
| `JWT_SECRET` not set | Missing env var | Add `JWT_SECRET` to `Backend/.env` (min 32 chars random) |
| `ERR_CONNECTION_REFUSED` on `localhost:5000` | Backend port in use | Kill process on 5000: `npx kill-port 5000` or change `PORT` in `Backend/.env` |

## Disaster Recovery

### Database Backup

- **Frequency**: Daily automated backups (MongoDB Atlas)
- **Retention**: 7 days point-in-time
- **Manual backup**: Available on request

### Recovery Time Objective (RTO)

- **Database**: < 1 hour (restore from backup)
- **Backend**: < 5 minutes (rollback deploy)
- **Frontend**: < 5 minutes (rollback deploy)

### Recovery Point Objective (RPO)

- **Database**: < 24 hours (daily backup)
- **Code**: 0 (git is the source of truth)

## Security Considerations

- Never commit secrets to git
- Rotate secrets every 90 days
- Use environment variables in deployment platforms
- Enable 2FA on Vercel, Render, MongoDB Atlas, Sentry
- Review access logs monthly