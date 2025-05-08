部署在cloudflare workers的一项服务

用于软件激活，采用kv作为数据库

1、使用前需要绑定一个kv,命名空间取为：SOFTWARE_LICENSE_KV

2、配置2个变量，username：<用户名>，password:<你的密码>，用于登录管理端

部署完成后就可以使用

路由有3个：/verify /login /manage
