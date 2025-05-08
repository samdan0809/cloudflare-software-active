
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname === '/verify') {
            return await verifyLicense(request, env);
        }
        else if (url.pathname === '/manage') {
          if (request.method === 'GET') {
              return await showManagePage(env);
          } else if (request.method === 'POST') {
              return await handleManageRequest(request, env);
          }
        }
        return new Response('Not Found', { status: 404 });
    },
  };
  
  async function verifyLicense(request, env) {
    const header={ 'Content-Type': 'application/json' };
    try {
        const { licenseKey } = await request.json();
        if (!licenseKey) {
            return new Response(JSON.stringify({ success: false, message: '缺少参数 licenseKey' }), {
                status: 400,
                headers: header
            });
        }
        const storedLicense = await env.book1.get(licenseKey);
        if (storedLicense) {
            return new Response(JSON.stringify({ success: true, message: '验证成功' }), {
                headers: header
            });
        } else {
              // 当验证失败时，延迟 1 秒返回响应
              await new Promise(resolve => setTimeout(resolve, 1000));
              return new Response(JSON.stringify({ success: false, message: '无效授权' }), {
                status: 401,
                headers: header
              });
        }
    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: '服务器出错误'+error  }), {
            status: 500,
            headers: header
        });
    }
  }