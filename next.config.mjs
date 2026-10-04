const basePath = process.env.BASE_PATH ?? ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
}

export default nextConfig
