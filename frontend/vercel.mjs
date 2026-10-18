const backendUrl = process.env.RENDER_BACKEND_URL;

if (!backendUrl) {
  throw new Error('Set RENDER_BACKEND_URL to the public HTTPS Render backend URL in Vercel.');
}

let backendOrigin;
try {
  const parsed = new URL(backendUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('RENDER_BACKEND_URL must be an HTTPS origin without a path or credentials.');
  }
  backendOrigin = parsed.origin;
} catch (error) {
  throw new Error(`Invalid RENDER_BACKEND_URL: ${error.message}`);
}

export const config = {
  rewrites: [
    { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
    { source: '/health', destination: `${backendOrigin}/health` },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
