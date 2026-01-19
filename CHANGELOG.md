# Changelog

All notable changes to this extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-19

### Added
- Automatic image enlargement on page load when extension is in "active" mode
- Multiple icon sizes (16px, 48px, 128px) for better browser display
- `tabs` permission for monitoring tab updates
- Proper error handling with try-catch blocks throughout the codebase
- Constants for configuration values (EXTENSION_NAME, DEFAULT_STATE, IMAGE_REGEX)

### Changed
- **Fixed critical state management bug** - State now persists correctly between browser sessions
- Refactored `action.js` with modern JavaScript patterns (async/await, nullish coalescing)
- Removed deprecated `webRequest` API usage (no longer needed for Manifest V3)
- Updated manifest.json for full Manifest V3 compliance
- Narrowed `host_permissions` to `<all_urls>` (standard for extensions)
- Improved image selection logic using `querySelector` instead of `getElementsByTagName`
- Added null checks for DOM operations to prevent crashes
- Split monolithic functions into smaller, focused functions

### Removed
- Deprecated `webRequest` permission and listeners
- Unused `callScript` function
- All debug `console.log` statements from production code

### Fixed
- State persistence bug where state was incorrectly overwritten
- Branch reference in GitHub workflows (master → main)
- SonarCloud project key consistency (fullheight-image → fullsize-image)

### Documentation
- Completely rewrote `PRIVACY_POLICY.md` with accurate information about image resizing functionality
- Removed incorrect references to "Bookmarker for Nextcloud" and bookmarks
- Added detailed explanation of data collection and local processing

## [1.0.0] - 2024-06-12

### Added
- Initial release of Fullsize Image extension
- Basic image resizing functionality for direct image URLs
- Toggle between active and sleeping states
