# Quick Fix for Local Development

## Problem
The MongoDB Atlas cluster is **paused** (free tier clusters pause after inactivity). The backend runs but can't connect to the database.

## Quick Fixes (choose one)

### Option 1: Resume Atlas Cluster (Fastest - 30 seconds)
1. Go to https://cloud.mongodb.com
2. Sign in → Select your project → Clusters
3. Click **"Resume"** on the paused cluster
3. Wait 30-60 seconds for it to resume
4. Restart backend: `cd Backend && npm start`

---

### Option 2: Create New Free Atlas Cluster (2-3 minutes)
1. Go to https://cloud.mongodb.com
2. Click **"Build a Database"** → **FREE** tier
3. Choose cloud provider/region (closest to you)
4. Create database user & allow access from anywhere (0.0.0.0/0)
3. Get new connection string → Update `MONGO_URI` in `Backend/.env`

---

### Option 3: Use Local MongoDB (No Cloud Dependency)

#### Option A: Install via MongoDB Installer (Recommended)
1. Download: https://www.mongodb.com/try/download/community
2. Choose: Windows → MSI → Download
3. Run installer → Choose "Complete" → Install as Service
4. Update `Backend/.env`:
   ```env
   MONGO_URI=mongodb://localhost:27017/cartify
   ```
4. Restart backend: `cd Backend && npm start`

#### Option B: Quick Local MongoDB (No Install)
Use the MongoDB Docker image (if Docker is available):
```bash
docker run -d -p 27017:27017 --name mongodb mongo:7
```
Then update `Backend/.env`:
```env
MONGO_URI=mongodb://localhost:27017/cartify
```

---

## Quick Test After Fix

```bash
# Terminal 1 - Backend
cd Backend && npm start
# Should show: "MongoDB Database Connected Successfully"

# Terminal 2 - Frontend
cd Frontend && npm run dev
# Open http://localhost:5173
```

---

## Current Status
- ✅ Backend code runs (port 5000)
- ✅ Frontend config ready (`VITE_API_URL=http://localhost:5000`)
- ✅ All env vars configured (MongoDB Atlas, Razorpay, Google OAuth, Email)
- ❌ MongoDB Atlas cluster is **paused** (free tier auto-pauses after inactivity)

---

**Quickest fix:** Go to MongoDB Atlas dashboard → Resume cluster → Restart backend. Takes ~1 minute.