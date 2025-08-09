- Get the ebookreader working.
- Local Library view needs to use local images.
- Add propper unit tests.

## Bug Fixes & Security Issues

### Critical Issues
- [x] Fix race condition in downloads page: handleClear() should wait for API completion before refreshing
- [x] Add proper error handling for JSON.parse() calls in metadata parsing (localItems.ts, maintenance route)
- [x] Fix path traversal vulnerability in download.js - implement proper path sanitization

### Medium Priority
- [] Fix memory leak in ItemCard.tsx: cleanup blob URLs and DOM elements on component unmount
- [] Add null checks before accessing object properties (item.downloads, blob.type, etc.)
- [] Implement proper input validation for parseInt() and Number() conversions
- [] Add radix parameter to parseInt() calls

### Minor Issues
- [] Add error boundaries for better component-level error handling
- [] Improve AbortController cleanup in BrowseResults.tsx
- [] Add user-facing error messages instead of console-only logging
- [] Enable TypeScript strict mode to catch more potential issues

### Security Improvements
- [] Sanitize file paths to prevent directory traversal attacks
- [] Validate all user inputs and API parameters
- [] Add proper CSRF protection for API endpoints