const fs = require('fs')
const path = require('path')

// Function to get allowed origins from config
function getAllowedOrigins() {
  try {
    const configPath = path.join(process.cwd(), 'config.json')
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      if (config.baseUrl) {
        // Extract host from baseUrl (remove protocol)
        const url = new URL(config.baseUrl)
        return [url.host]
      }
    }
  } catch (error) {
    console.warn('Could not read config for allowedOrigins, using default')
  }
  return ['localhost:3000'] // fallback
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins()
    },
  },
  // Partial static export configuration
  // Note: Full static export is disabled to maintain dynamic functionality
  // Individual pages can be statically generated using generateStaticParams
  images: {
    domains: ['archive.org'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'archive.org',
        pathname: '/services/img/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Handle BookReader CSS
    config.module.rules.push({
      test: /BookReader\.css$/,
      use: ['style-loader', 'css-loader'],
    })
    
    return config
  }
}

module.exports = nextConfig
