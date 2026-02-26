# 前端应用说明

## 目录结构

```
frontend/
├── index.html      # 主页面
├── style.css       # 样式表
├── script.js       # 交互逻辑
└── README.md       # 说明文档
```

## 功能特性

### 1. 短信检测模块
- 📝 文本输入框：支持输入长文本（最长500字符）
- 🔍 一键检测：快速进行垃圾短信检测
- 📊 结果展示：显示分类结果、置信度和概率分布

### 2. 数据统计模块
- 📈 总检测次数统计
- 🚫 垃圾短信数量统计
- ✅ 正常短信数量统计
- 📊 饼图展示垃圾/正常比例

### 3. 检测历史模块
- 📋 显示最近100条检测记录
- 🕐 记录检测时间和结果
- 📍 快速浏览历史数据

## 如何使用

### 直接在浏览器打开
确保后端服务运行在 `http://localhost:8080` 后，直接在浏览器中打开 `index.html` 文件。

### 使用本地 Web 服务器（推荐）

```bash
# 使用 Python 3
python -m http.server 8000

# 或使用 Node.js
npx http-server -p 8000
```

然后访问 `http://localhost:8000`

### 使用 Spring Boot 静态资源

将前端文件放在 `backend/src/main/resources/static/` 目录下，前端会自动通过后端服务提供。

## API 调用

### 检测短信
```javascript
fetch('http://localhost:8080/api/detection/detect', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        content: '要检测的短信内容'
    })
})
```

### 获取统计信息
```javascript
fetch('http://localhost:8080/api/detection/statistics')
```

## 技术栈

- **HTML5**: 语义化页面结构
- **CSS3**: 响应式设计、Flexbox、Grid 布局、渐变效果
- **JavaScript (原生)**: 不依赖任何前端框架
- **ECharts 5**: 数据可视化（柱状图、饼图）
- **Fetch API**: 与后端通信

## 主要组件

### 顶部导航
- 系统标题和简介

### 检测区域
- 文本输入框
- 一键检测按钮
- 结果展示卡片
- 错误提示区域

### 统计区域
- 数据卡片（总数、垃圾数、正常数）
- 饼图（分类比例）
- 自动刷新提示

### 历史记录表
- 表格显示最近检测记录
- 支持分页查看

### 页脚
- 版权信息和技术栈说明

## 样式特点

- 🎨 现代化渐变配色
- 📱 完全响应式设计
- ✨ 流畅的动画效果
- 🎯 良好的用户体验
- ♿ 无障碍设计支持

## 响应式断点

- **Desktop**: > 1024px
- **Tablet**: 768px - 1024px
- **Mobile**: < 768px

## 配置参数

在 `script.js` 中可以修改：

```javascript
// API 基址
const API_BASE_URL = 'http://localhost:8080/api';

// 统计数据刷新间隔（毫秒）
const STATS_REFRESH_INTERVAL = 5000;
```

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 故障排除

### 1. 无法连接到后端
- 确保 Spring Boot 后端运行在 `http://localhost:8080`
- 检查浏览器控制台错误信息
- 确保后端配置了 CORS 跨域支持

### 2. 图表不显示
- 检查 ECharts CDN 是否正确加载
- 查看浏览器控制台是否有加载错误
- 清除浏览器缓存重试

### 3. 检测失败
- 确保 Python ML 服务运行在 `http://localhost:5000`
- 检查短信内容长度和格式
- 查看后端日志了解详细错误

## 部署建议

### 开发环境
直接使用 Python 内置服务器或在 IDE 中打开 HTML 文件

### 生产环境
1. 将前端文件放在 Spring Boot 静态资源目录
2. 配置 Spring Boot 提供前端应用
3. 使用 CDN 加速静态资源加载
4. 启用 GZIP 压缩

## 许可证
MIT
