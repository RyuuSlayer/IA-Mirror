- Get the ebookreader working.
- Add proper unit tests.
- Get collection browsing to work.

## Bug Fixes & Security Issues

### Critical Issues
- [x] Fix race condition in downloads page: handleClear() should wait for API completion before refreshing
- [x] Add proper error handling for JSON.parse() calls in metadata parsing (localItems.ts, maintenance route)
- [x] Fix path traversal vulnerability in download.js - implement proper path sanitization

### Medium Priority
- [x] Fix memory leak in ItemCard.tsx: cleanup blob URLs and DOM elements on component unmount
- [x] Add null checks before accessing object properties (item.downloads, blob.type, etc.)
- [x] Implement proper input validation for parseInt() and Number() conversions
- [x] Add radix parameter to parseInt() calls

### Minor Issues
- [x] Add error boundaries for better component-level error handling
- [x] Improve AbortController cleanup in BrowseResults.tsx
- [x] Add user-facing error messages instead of console-only logging
- [x] Enable TypeScript strict mode to catch more potential issues

### Security Improvements
- [] Sanitize file paths to prevent directory traversal attacks
- [] Validate all user inputs and API parameters
- [] Add proper CSRF protection for API endpoints