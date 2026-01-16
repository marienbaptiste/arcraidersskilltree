# Deployment Guide

## Deploy to Vercel (Recommended)

Vercel is the easiest way to deploy this Next.js application.

### Method 1: Deploy via GitHub (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/skill-tree-planner.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up or log in
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

3. **Done!**
   - Your app will be live at `https://your-project-name.vercel.app`
   - Automatic deployments on every git push

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd skill-tree-planner
   vercel
   ```

3. **Follow the prompts**
   - Link to existing project or create new
   - Confirm settings
   - Deploy!

### Build Configuration

The project is configured to use webpack (not Turbopack) to support SVGR:

```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack"
  }
}
```

Vercel will automatically use these scripts.

### Environment Variables

No environment variables are required for basic functionality.

If you add any in the future:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add your variables
4. Redeploy

## Deploy to Other Platforms

### Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build the app**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### AWS Amplify

1. Connect your Git repository
2. Use these build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
   - Framework: Next.js

### Docker (Self-hosted)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t skill-tree-planner .
docker run -p 3000:3000 skill-tree-planner
```

## Custom Domain

### On Vercel

1. Go to your project settings
2. Navigate to Domains
3. Add your custom domain
4. Follow DNS configuration instructions

## Performance Optimization

The build is already optimized with:
- ✅ Static page generation
- ✅ Automatic code splitting
- ✅ Image optimization (Next.js)
- ✅ CSS minification
- ✅ Tree shaking

## Troubleshooting

### Build fails with Turbopack error

Make sure your scripts use the `--webpack` flag:
```json
"build": "next build --webpack"
```

### SVG not loading

Ensure SVGR is configured in `next.config.ts`:
```typescript
webpack(config) {
  config.module.rules.push({
    test: /\.svg$/,
    use: ['@svgr/webpack'],
  });
  return config;
}
```

### localStorage not working

This is expected on first render (SSR). The app handles this gracefully with the `useEffect` hook.

## Monitoring

After deployment, consider adding:
- [Vercel Analytics](https://vercel.com/analytics)
- [Sentry](https://sentry.io) for error tracking
- [Google Analytics](https://analytics.google.com)

## Continuous Deployment

With Vercel + GitHub:
- Every push to `main` → Production deployment
- Every pull request → Preview deployment
- Automatic HTTPS certificates
- Global CDN distribution

## Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
