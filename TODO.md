- Get collection browsing to work.
- Handle torrent files as derivatives.

## Code Quality & Performance Improvements

### Low Priority
- [ ] Add compression for API responses
- [ ] Optimize bundle size and implement code splitting
- [ ] Add proper documentation for API endpoints

## Next.js Modern Features Implementation

### High Priority
- [ ] Implement Server Components for static content (replace client components where possible)
- [ ] Add React Server Actions for form submissions and data mutations
- [ ] Implement Partial Prerendering (PPR) for improved performance
- [ ] Use Next.js 15 turbopack for faster development builds

### Medium Priority
- [ ] Implement Streaming SSR with loading.tsx boundaries for better UX
- [ ] Add Route Groups for better organization (e.g., (dashboard), (auth))
- [ ] Implement Parallel Routes for complex layouts with multiple data sources
- [ ] Use Next.js Image optimization with placeholder="blur" for better loading
- [ ] Implement Intercepting Routes for modal-like experiences
- [ ] Add Server-side form validation with Server Actions
- [ ] Use React 19 useOptimistic hook for optimistic UI updates

### Low Priority
- [x] Implement Next.js Middleware for advanced routing and authentication
- [x] Add Static Exports for portions that can be pre-generated
- [ ] Use React 19 use() hook for data fetching in components
- [ ] Implement Next.js Draft Mode for content preview
- [ ] Add Edge Runtime for API routes where applicable
- [ ] Use React 19 useActionState for better form state management
- [ ] Implement Next.js Analytics for performance monitoring