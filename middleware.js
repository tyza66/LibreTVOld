import { sha256 } from './js/sha256.js'; // 需新建或引入SHA-256实现

// Vercel Middleware to inject environment variables
export default async function middleware(request) {
  // Get the URL from the request
  const url = new URL(request.url);
  
  // 1) 运行时快捷跳过：所有带扩展名(且非 .html)的一律不处理，直接放行
  const hasExtension = /\.[^/]+$/.test(url.pathname);
  if (hasExtension && !url.pathname.endsWith('.html')) {
    return; // 静态资源：css/js/png/svg/webp/json/map/txt 等
  }

  // 2) 再次按路径前缀跳过常见静态目录，双保险
  const staticPrefixes = ['/css/', '/js/', '/libs/', '/image/', '/images/', '/img/', '/fonts/', '/static/'];
  if (staticPrefixes.some((p) => url.pathname.startsWith(p))) {
    return; // 静态目录：不进行任何处理
  }
  
  // Only process HTML pages
  const isHtmlPage = url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (!isHtmlPage) {
    return; // Let the request pass through unchanged
  }

  // Fetch the original response
  const response = await fetch(request);
  
  // Check if it's an HTML response
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response; // Return the original response if not HTML
  }

  // Get the HTML content
  const originalHtml = await response.text();
  
  // Replace the placeholder with actual environment variable
  // If PASSWORD is not set, replace with empty string
  const password = process.env.PASSWORD || '';
  let passwordHash = '';
  if (password) {
    passwordHash = await sha256(password);
  }

  const adminpassword = process.env.ADMINPASSWORD || '';
  let adminpasswordHash = '';
  if (adminpassword) {
    adminpasswordHash = await sha256(adminpassword); // 修复变量名
  }
  
  // 合并两次替换为一次操作
  let modifiedHtml = originalHtml
    .replace(
      'window.__ENV__.PASSWORD = "{{PASSWORD}}";',
      `window.__ENV__.PASSWORD = "${passwordHash}"; // SHA-256 hash`
    )
    .replace(
      'window.__ENV__.ADMINPASSWORD = "{{ADMINPASSWORD}}";',
      `window.__ENV__.ADMINPASSWORD = "${adminpasswordHash}"; // SHA-256 hash`
    );

  // 修复Response构造
  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export const config = {
  // 仅匹配需要注入环境变量的 HTML 路由；排除常见静态目录与文件
  // 说明：这里使用负向前瞻排除静态目录，并且保留根路径与任意不含点的路径（通常是无扩展名的页面路由）
  matcher: [
    '/',
    '/((?!api|_next/static|_vercel|favicon.ico|css/|js/|libs/|image/|images/|img/|fonts/|static/|robots\.txt|manifest\.json|service-worker\.js).*)'
  ],
};