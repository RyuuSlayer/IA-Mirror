/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    },
  },
  images: {
    domains: ['archive.org', 'archive.org'],
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
