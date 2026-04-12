# 前端说明

## 当前结构

```text
frontend/
├── index.html              # 后台系统页，对应 / 和 /dashboard
├── login.html              # 登录页，对应 /login
├── register.html           # 注册页，对应 /register
├── style.css               # 全局样式
├── serve-preview.js        # 本地静态预览服务
└── js/
    ├── auth-shared.js      # 登录 / 注册页共享认证存储
    ├── login-page.js       # 登录页逻辑
    ├── register-page.js    # 注册页逻辑
    ├── core.js             # 后台全局状态与 DOM 引用
    ├── auth.js             # 后台登录态与守卫
    ├── ui.js               # 后台导航与通用交互
    ├── detection.js        # 检测、批量任务、图表
    ├── data-modules.js     # 历史、模板、规则、反馈
    ├── bootstrap.js        # 后台入口初始化
    └── utils.js            # 工具函数
```

## 路由

- `/login`：登录页
- `/register`：注册页
- `/dashboard`：后台系统页
- `/`：后台系统页入口

## 认证说明

- 登录和注册调用后端真实接口：
  - `POST /api/auth/login`
  - `POST /api/auth/register`
- 登录态存放在 `sessionStorage`
- 关键键：
  - `sms_current_user_v1`
  - `sms_auth_token_v1`
  - `sms_login_flag_v1`
  - `sms_auth_notice_v1`

## 启动

```powershell
.\start-all.ps1
```

停止服务：

```powershell
.\stop-all.ps1
```
