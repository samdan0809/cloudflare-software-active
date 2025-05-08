

import loginhtml from './views/login.html';
import indexhtml from './views/index.html';

var VALID_USERNAME = '';
var VALID_PASSWORD = '';
const TOKEN_EXPIRATION_TIME = 3600 * 4; // 4 小时，单位为秒
const JSON_HEADER={ 'Content-Type': 'application/json' };
const LOGIN_TOKENS_KEY = 'tokens';
// 定义路由映射
const routes = {
    '/verify': {
        get: null,
        post: verifyLicense
    },
    '/login': {
        get: showLoginPage,
        post: handleLogin
    },
    '/manage': { 
        get: showManagePage,
        post: withAuthentication(handleManageRequest)
    }
};

// 生成唯一的 token
function generateToken(length = 32) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        token += characters.charAt(randomIndex);
    }
    return token;
}

 

// 登录验证中间件
function withAuthentication(handler) {
    return async (request, env) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');
        const storedTokens = await env.SOFTWARE_LICENSE_KV.get(LOGIN_TOKENS_KEY);
        const parsedTokens = storedTokens ? JSON.parse(storedTokens) : [];
        const validToken = parsedTokens.find(t => t.token === token && t.expiration > Date.now() / 1000);
        if (!validToken) {
            return new Response('Unauthorized', { status: 401 });
        }
        return await handler(request, env);
    };
}


async function verifyLicense(request, env) {
   
    try {
        const { licenseKey } = await request.json();
        if (!licenseKey) {
            return new Response(JSON.stringify({ success: false, message: 'License key is missing' }), {
                status: 400,
                headers: JSON_HEADER
            });
        }
        const storedLicense = await env.SOFTWARE_LICENSE_KV.get(licenseKey);
        if (storedLicense) {
            return new Response(JSON.stringify({ success: true, message: 'Valid license' }), {
                headers: JSON_HEADER
            });
        } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return new Response(JSON.stringify({ success: false, message: 'Invalid license' }), {
                status: 401,
                headers: JSON_HEADER
            });
        }
    } catch (error) {
        console.error('Verify license error:', error);
        return new Response(JSON.stringify({ success: false, message: 'An error occurred during verification' }), {
            status: 500,
            headers: JSON_HEADER
        });
    }
}

async function showLoginPage() {
    const html = loginhtml;
    return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
    });
}

async function handleLogin(request, env) {
    try {
        const formData = await request.formData();
        const username = formData.get('username');
        const password = formData.get('password');

        if (username === VALID_USERNAME && password === VALID_PASSWORD) {
            const token = generateToken();
            const loginTime = Date.now() / 1000;
            const expiration = loginTime + TOKEN_EXPIRATION_TIME;

            const storedTokens = await env.SOFTWARE_LICENSE_KV.get(LOGIN_TOKENS_KEY);
            const parsedTokens = storedTokens ? JSON.parse(storedTokens) : [];

            // 清理过期的 token
            const validTokens = parsedTokens.filter(t => t.expiration > Date.now() / 1000);

            const newTokenObj = {
                token,
                loginTime,
                expiration
            };

            parsedTokens.push(newTokenObj);

            await env.SOFTWARE_LICENSE_KV.put(LOGIN_TOKENS_KEY, JSON.stringify(parsedTokens));

            return new Response(JSON.stringify({ token }), {
                status: 200,
                headers: JSON_HEADER
            });
        } else {
            return new Response('Invalid username or password', { status: 401 });
        }
    } catch (error) {
        console.error('Login error:', error);
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

async function showManagePage(request, env) {
    try {
        const html = indexhtml;
        return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error) {
        console.error('Show manage page error:', error);
        return new Response('An error occurred while loading the manage page', { status: 500 });
    }
}


async function handleManageRequest(request, env) {
    try {
        const formData = await request.formData();
        const action = formData.get('action');
       
        const deleteKey = formData.get('deleteKey');
        const verifyToken = formData.get('verifyToken');
        const batchCount = formData.get('batchCount');
        const searchToken = formData.get('searchToken');
        const page = parseInt(formData.get('page')) || 1;
        const pageSize = parseInt(formData.get('pageSize')) || 10;

        //验证toKen 是否有效
        if (verifyToken) {
            const storedTokens = await env.SOFTWARE_LICENSE_KV.get(LOGIN_TOKENS_KEY);
            const parsedTokens = storedTokens ? JSON.parse(storedTokens) : [];
            const validToken = parsedTokens.find(t => t.token === verifyToken && t.expiration > Date.now() / 1000);
            if (validToken) {
                return new Response('Token verified', { status: 200 });
            } else {
                return new Response('Invalid or expired token', { status: 401 });
            }
        }

        switch (action) {
            case 'getKeys':
                if (!env.SOFTWARE_LICENSE_KV) {
                    console.error('SOFTWARE_LICENSE_KV is undefined in env');
                    return new Response('KV namespace is not properly configured', { status: 500 });
                }
               
                const keys = await env.SOFTWARE_LICENSE_KV.list();
                let keyList = keys.keys.map(async key => {
                    const value = await env.SOFTWARE_LICENSE_KV.get(key.name);
                    return {
                        key: key.name,
                        isActivated: value == '1'?false:true,
                        
                    };
                });

                //排除登录的键
                keyList = keyList.filter(key => !key.includes(LOGIN_TOKENS_KEY));

                if (searchToken) {
                    keyList = keyList.filter(key => key.includes(searchToken));
                }


                const startIndex = (page - 1) * pageSize;
                const endIndex = startIndex + pageSize;
                const paginatedKeys = keyList.slice(startIndex, endIndex);

                return new Response(JSON.stringify({
                    keys: paginatedKeys, total: keyList.length
                }), {
                    headers: JSON_HEADER
                });
  
            case 'deleteKey':
                if (deleteKey) {
                    await env.SOFTWARE_LICENSE_KV.delete(deleteKey);
                    return new Response('Key deleted successfully', { status: 200 });
                }
                break;
            case 'batchGenerate':
                if (batchCount) {
                    const count = parseInt(batchCount);
                    const newKeys = [];
                    for (let i = 0; i < count; i++) {
                        const newKey = generateToken();
                        newKeys.push(newKey);
                        await env.SOFTWARE_LICENSE_KV.put(newKey, '1');
                    }
                    return new Response(JSON.stringify({ message: 'Batch keys generated successfully', keys: newKeys }), {
                        status: 200,
                        headers: JSON_HEADER
                    });
                }
                break;
            default:
                return new Response('Invalid action', { status: 400 });
        }

        return new Response('Invalid request', { status: 400 });
    } catch (error) {
        console.error('Manage request error:', error);
        return new Response('An error occurred while processing the manage request', { status: 500 });
    }
}


export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const path = url.pathname;
            const method = request.method.toLowerCase();

            VALID_USERNAME=env.username;
            VALID_PASSWORD=env.password;

            const route = routes[path];
            if (route && route[method]) {
                return await route[method](request, env);
            }

            return new Response('Not Found', { status: 404 });
        } catch (error) {
            console.error('Fetch error:', error);
            return new Response('Internal Server Error'+error, { status: 500 });
        }
    },
};
