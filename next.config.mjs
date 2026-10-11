const basePath = process.env.BASE_PATH ?? ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
  // Analytics snapshots can be slow when a patch window contains many matches.
  staticPageGenerationTimeout: 120,
  experimental: { cpus: 2 },
}

export default nextConfig
