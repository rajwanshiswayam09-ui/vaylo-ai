/** @type {import('next').NextConfig} */
const cspHeader = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.razorpay.com https://generativelanguage.googleapis.com; frame-src 'self' https://api.razorpay.com";

const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: cspHeader },
        ],
      },
    ];
  },
};

export default nextConfig;
