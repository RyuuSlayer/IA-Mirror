# Internet Archive Mirror

A Next.js application that allows you to browse and download content from the Internet Archive locally. Create your own offline digital library with millions of books, movies, software, music, and more from archive.org.

## Features

- 🌐 Browse Internet Archive content offline
- 📥 Download and store items locally
- 🔍 Search through your local library
- 🖼️ View item details, metadata, and files
- 📚 Support for multiple media types (books, videos, software, etc.)
- 💾 Efficient local storage system
- 🚀 Fast, modern web interface

## Prerequisites

- Windows 10 or later
- Node.js 18 or higher
- npm or yarn
- Git (optional, for development)
- At least 1GB of free RAM
- Storage space for downloaded content (varies based on usage)

### Windows Prerequisites Installation

1. Install Node.js:
   - Download the latest LTS version from [Node.js website](https://nodejs.org/)
   - Run the installer and follow the installation wizard
   - Make sure to check "Automatically install the necessary tools"
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. Install Git (Optional):
   - Download from [Git website](https://git-scm.com/download/win)
   - Run the installer with default options

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/RyuuSlayer/IA-Mirror.git
   cd IA-Mirror
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Change `config.json` file in the root directory:
   ```json
   {
     "cacheDir": "path/to/storage",
     "maxConcurrentDownloads": 3,
     "skipDerivativeFiles": true
   }
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Browsing Content

1. Visit the homepage to see featured items and collections
2. Use the search bar to find specific items
3. Browse by media type (books, videos, software, etc.)
4. Click on an item to view its details

### Downloading Items

1. Navigate to an item's page
2. Click the download button for individual files or the entire item
3. Monitor download progress in the downloads section
4. Access downloaded content offline through your local library

## Running as a Windows Service (Optional)

To have the application start automatically with Windows:

1. Install node-windows globally:
   ```bash
   npm install -g node-windows
   ```

2. Install the service:
   ```bash
   npm run install-service
   ```

3. The service will now start automatically with Windows
4. Manage it in Windows Services (services.msc)

## Development

1. Run the development server:
   ```bash
   npm run dev
   ```

2. Build for production:
   ```bash
   npm run build
   ```

3. Start production server:
   ```bash
   npm start
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request