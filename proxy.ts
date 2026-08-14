import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  // 页面访问继续跳转到登录页；API 由路由内的 requireAdmin 返回统一 JSON 错误。
  matcher: ['/admin/:path*', '/backup/:path*'],
};
