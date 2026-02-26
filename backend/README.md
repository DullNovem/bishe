# Spring Boot 后端说明

## 目录结构

```
backend/
├── src/
│   └── main/
│       ├── java/
│       │   └── com/bishe/
│       │       ├── controller/          # REST API 控制器
│       │       │   └── SMSDetectionController.java
│       │       ├── service/             # 业务逻辑层
│       │       │   └── SMSDetectionService.java
│       │       ├── entity/              # 实体类
│       │       │   ├── SMSDetectionRecord.java
│       │       │   ├── SMSDetectionRequest.java
│       │       │   ├── SMSDetectionResponse.java
│       │       │   ├── StatisticsDTO.java
│       │       │   └── ApiResponse.java
│       │       ├── repository/          # 数据库访问层
│       │       │   └── SMSDetectionRecordRepository.java
│       │       └── BisheApplication.java    # 启动类
│       └── resources/
│           ├── application.yml          # 配置文件
│           └── static/                  # 前端静态资源
├── pom.xml                              # Maven 配置
└── README.md                            # 说明文档
```

## 快速开始

### 1. 环境要求
- Java 8 及以上
- MySQL 8.0
- Maven 3.6+

### 2. 数据库配置

创建数据库：
```sql
CREATE DATABASE spam_sms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

修改 `src/main/resources/application.yml` 中的数据库配置：
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/spam_sms_db
    username: 你的用户名
    password: 你的密码
```

### 3. 编译和运行

```bash
# 编译
mvn clean package

# 运行
java -jar target/spam-sms-detection-0.0.1-SNAPSHOT.jar

# 或使用 Maven 直接运行
mvn spring-boot:run
```

应用将启动在 `http://localhost:8080`

## API 接口文档

### 1. 检测短信接口

**请求**
```
POST /api/detection/detect
Content-Type: application/json

{
  "content": "要检测的短信内容",
  "userId": "user123"        // 可选
}
```

**响应**
```json
{
  "code": 200,
  "message": "检测成功",
  "data": {
    "label": "spam",
    "confidence": 0.95,
    "normalProbability": 0.05,
    "spamProbability": 0.95,
    "timestamp": 1645234567000,
    "modelVersion": "1.0.0"
  }
}
```

### 2. 获取统计信息接口

**请求**
```
GET /api/detection/statistics
```

**响应**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "totalDetections": 150,
    "spamCount": 45,
    "normalCount": 105,
    "spamPercentage": 30.0,
    "normalPercentage": 70.0
  }
}
```

### 3. 获取最近记录接口

**请求**
```
GET /api/detection/recent-records?limit=10
```

**响应**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "smsContent": "短信内容...",
      "classification": 1,
      "label": "spam",
      "confidence": 0.95,
      "detectionTime": "2024-02-25T13:47:57",
      "modelVersion": "1.0.0"
    }
  ]
}
```

### 4. 健康检查接口

**请求**
```
GET /api/detection/health
```

**响应**
```json
{
  "code": 200,
  "message": "系统运行正常",
  "data": null
}
```

## 配置说明

### application.yml 主要配置

```yaml
# 应用配置
spring:
  application:
    name: spam-sms-detection
  
  # 数据库配置
  datasource:
    url: jdbc:mysql://localhost:3306/spam_sms_db
    username: root
    password: root
    driver-class-name: com.mysql.cj.jdbc.Driver
  
  # JPA 配置
  jpa:
    hibernate:
      ddl-auto: update    # 自动更新数据库表结构
    show-sql: true

# 服务器配置
server:
  port: 8080
  servlet:
    context-path: /api

# 机器学习服务配置
ml:
  server:
    url: http://localhost:5000
    predict-endpoint: /predict

# 日志配置
logging:
  level:
    root: INFO
    com.bishe: DEBUG
```

## 项目架构

### MVC 架构

```
Controller (接收请求)
    ↓
Service (业务逻辑)
    ↓
Repository (数据库访问)
    ↓
Database (数据持久化)
```

### 数据流程

```
前端请求
    ↓
Controller 验证请求
    ↓
Service 调用 ML 服务
    ↓
Repository 保存记录
    ↓
返回响应给前端
```

## 核心类说明

### SMSDetectionController
REST API 控制器，处理所有 HTTP 请求

**主要方法：**
- `detectSMS()`: 检测短信
- `getStatistics()`: 获取统计数据
- `getRecentRecords()`: 获取最近记录
- `health()`: 健康检查

### SMSDetectionService
业务逻辑层，实现检测和统计功能

**主要方法：**
- `detectSMS()`: 执行检测并保存记录
- `callMLService()`: 调用 Python ML 服务
- `saveDetectionRecord()`: 保存记录到数据库
- `getStatistics()`: 计算统计信息

### SMSDetectionRecord
数据库实体，代表一条检测记录

**字段：**
- `id`: 主键
- `smsContent`: 短信内容
- `classification`: 分类结果 (0=正常, 1=垃圾)
- `label`: 分类标签 (spam/normal)
- `confidence`: 置信度
- `detectionTime`: 检测时间
- `modelVersion`: 模型版本

## 依赖说明

```xml
<!-- Spring Boot Web -->
spring-boot-starter-web

<!-- 数据库和 ORM -->
spring-boot-starter-data-jpa
mysql-connector-java:8.0.33

<!-- 工具库 -->
lombok               # 减少代码量
fastjson:2.0.7      # JSON 处理
httpclient:4.5.13   # HTTP 客户端

<!-- 测试 -->
spring-boot-starter-test
```

## 数据库表结构

### sms_detection_record 表

```sql
CREATE TABLE sms_detection_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sms_content LONGTEXT NOT NULL,
  classification INT NOT NULL,
  label VARCHAR(20),
  confidence DOUBLE,
  detection_time DATETIME,
  model_version VARCHAR(20)
);
```

## 错误处理

### HTTP 状态码

- **200**: 请求成功
- **400**: 请求参数错误
- **500**: 服务器内部错误
- **404**: 端点不存在

### 响应格式

所有响应都遵循统一格式：

```json
{
  "code": 200,           // HTTP 状态码
  "message": "success",  // 消息
  "data": {}            // 数据（错误时为 null）
}
```

## 跨域配置

已在 Controller 中配置 CORS，允许来自任何源的请求：

```java
@CrossOrigin(origins = "*", maxAge = 3600)
```

## 性能优化建议

1. **数据库优化**
   - 为 `detection_time` 字段添加索引
   - 定期清理旧数据

2. **缓存**
   - 使用 Redis 缓存统计数据
   - 减少数据库查询

3. **线程池**
   - 配置异步处理检测请求
   - 提高并发能力

4. **连接池**
   - 配置 HikariCP 连接池
   - 优化数据库连接管理

## 部署建议

### 开发环境
使用 Maven 和 IDE 直接运行

### 测试环境
```bash
java -jar spam-sms-detection-0.0.1-SNAPSHOT.jar \
  --spring.datasource.url=jdbc:mysql://test-db:3306/spam_sms_db \
  --spring.datasource.username=test_user \
  --spring.datasource.password=test_password
```

### 生产环境
1. 使用独立数据库服务器
2. 配置数据库备份和恢复
3. 启用日志记录和监控
4. 使用反向代理（Nginx）
5. 配置 SSL/TLS

## 故障排除

### 1. 连接 ML 服务失败
- 确保 Python Flask 服务运行在 `http://localhost:5000`
- 检查防火墙和网络连接
- 查看日志了解详细错误

### 2. 数据库连接失败
- 确认 MySQL 服务运行
- 检查数据库用户名和密码
- 确保数据库 `spam_sms_db` 存在

### 3. API 响应缓慢
- 检查数据库查询性能
- 添加数据库索引
- 使用缓存减少数据库查询

## 许可证
MIT
