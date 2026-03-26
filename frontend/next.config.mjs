/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg', 'pg-native'],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/ws/:path*`,
      },
    ]
  },
}

export default nextConfig
