### **5. Deployment Guide (`docs/DEPLOYMENT.md`)**
How to put this on a real server (like AWS, DigitalOcean, or Vercel).

**File:** `docs/DEPLOYMENT.md`

```markdown
# Deployment Guide

## Checklist Before Deploying
- [ ] MongoDB Network Access set to **Production IP only** (Whitelist).
- [ ] `NODE_ENV` set to `production` in environment variables.
- [ ] `console.log` statements removed or minimized.

## Option 1: Render / Vercel (PaaS)
1. Push code to GitHub.
2. Connect repository to Render/Vercel.
3. Add Environment Variables in the dashboard settings.
4. Deploy.

## Option 2: VPS (Ubuntu/DigitalOcean)
1. Install Node.js and PM2:
   ```bash
   sudo apt update
   sudo apt install nodejs npm
   sudo npm install -g pm2