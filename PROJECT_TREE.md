# 项目文件树

## 完整项目结构

```
bishe/
├── README.md                           # 项目总说明
├── QUICKSTART.md                       # 快速开始指南（重点阅读！）
│
├── backend/                            # Spring Boot 后端服务
│   ├── pom.xml                        # Maven 项目配置
│   ├── README.md                      # 后端详细说明
│   └── src/
│       └── main/
│           ├── java/
│           │   └── com/bishe/
│           │       ├── BisheApplication.java          # 应用启动类
│           │       ├── controller/
│           │       │   └── SMSDetectionController.java # REST API 控制器
│           │       ├── service/
│           │       │   └── SMSDetectionService.java    # 业务逻辑层
│           │       ├── entity/
│           │       │   ├── ApiResponse.java            # 统一响应格式
│           │       │   ├── SMSDetectionRecord.java     # 检测记录实体
│           │       │   ├── SMSDetectionRequest.java    # 请求 DTO
│           │       │   ├── SMSDetectionResponse.java   # 响应 DTO
│           │       │   └── StatisticsDTO.java          # 统计信息 DTO
│           │       └── repository/
│           │           └── SMSDetectionRecordRepository.java # 数据访问层
│           └── resources/
│               ├── application.yml    # Spring Boot 配置文件
│               └── static/            # 前端静态资源目录（可选）
│
├── ml-model/                           # Python 机器学习模块
│   ├── README.md                      # ML 模块详细说明
│   ├── requirements.txt                # Python 依赖列表
│   ├── api_server.py                  # Flask API 服务主文件
│   ├── src/
│   │   ├── train.py                   # 模型训练脚本
│   │   ├── model.py                   # 分类器类定义
│   │   └── utils.py                   # 文本预处理和特征提取工具
│   ├── data/
│   │   └── SMSSpamCollection.csv      # 数据集文件
│   └── model/
│       ├── spam_model.pkl             # 训练好的模型（首次自动生成）
│       └── vectorizer.pkl             # 特征向量化器（首次自动生成）
│
├── frontend/                           # Web 前端应用
│   ├── README.md                      # 前端详细说明
│   ├── index.html                     # 主页面（HTML5）
│   ├── style.css                      # 样式表（CSS3）
│   └── script.js                      # 交互逻辑（Vanilla JavaScript）
│
└── 项目说明文档/
    ├── README.md          - 项目总体介绍
    ├── QUICKSTART.md      - 5分钟快速开始指南 ⭐ 必读
    ├── PROJECT_TREE.md    - 本文件，项目结构说明
    └── API_DOCS.md        - API 接口完整文档
```

## 关键文件说明

### 🚀 启动文件
| 文件 | 作用 | 命令 |
|------|------|------|
| `ml-model/src/train.py` | 训练 ML 模型 | `python src/train.py` |
| `ml-model/api_server.py` | 启动 Flask API | `python api_server.py` |
| `backend/pom.xml` | 启动 Java 后端 | `mvn spring-boot:run` |
| `frontend/index.html` | 打开前端应用 | 直接用浏览器打开 |

### 📝 配置文件
| 文件 | 用途 | 修改频率 |
|------|------|--------|
| `backend/src/main/resources/application.yml` | 数据库和服务配置 | 首次 |
| `ml-model/requirements.txt` | Python 依赖 | 很少 |
| `frontend/script.js` (第1-2行) | API 基础地址 | 首次 |

### 📚 文档文件
| 文件 | 内容 |
|------|------|
| `README.md` | 项目概览 |
| `QUICKSTART.md` | 快速开始指南（⭐ 从这里开始）|
| `backend/README.md` | 后端详细文档 |
| `ml-model/README.md` | ML 模块详细文档 |
| `frontend/README.md` | 前端详细文档 |

## 核心模块详解

### 1️⃣ Python 机器学习模块（ml-model/）

**职责：** 数据处理、模型训练、短信分类预测

**工作流：**
```
加载数据
  ↓
文本预处理（分词、去停用词）
  ↓
特征提取（TF-IDF）
  ↓
训练朴素贝叶斯分类器
  ↓
模型评估与保存
  ↓
启动 Flask API 服务
  ↓
接收预测请求，返回分类结果
```

**关键类：**
- `SpamClassifier`: 分类器主类
  - `train()`: 训练模型
  - `predict_single()`: 单条预测
  - `evaluate()`: 模型评估

- `TextPreprocessor`: 文本处理
  - `clean_text()`: 清理文本
  - `tokenize()`: 分词

- `FeatureExtractor`: 特征提取
  - `fit_transform()`: 提取训练特征
  - `transform()`: 提取测试特征

### 2️⃣ Spring Boot 后端服务（backend/）

**职责：** 提供 REST API、管理数据库、协调各模块

**工作流：**
```
接收前端请求
  ↓
参数验证
  ↓
调用 ML 服务预测
  ↓
保存记录到数据库
  ↓
返回结果给前端
  ↓
统计数据查询
```

**核心层次：**
```
Controller (处理 HTTP 请求)
    ↓
Service (业务逻辑)
    ↓
Repository (数据库访问)
    ↓
Database (数据持久化)
```

**关键 API：**
- `POST /api/detection/detect` - 检测短信
- `GET /api/detection/statistics` - 获取统计
- `GET /api/detection/recent-records` - 获取历史

### 3️⃣ 前端 Web 应用（frontend/）

**职责：** 用户界面、交互逻辑、数据展示

**主要功能：**
1. 短信输入与检测
2. 结果展示（标签、置信度、概率分布）
3. 数据统计仪表板
4. 检测历史记录表
5. 实时数据可视化（ECharts）

**技术特点：**
- 原生 JavaScript，无框架依赖
- 响应式设计，支持移动设备
- 现代化 UI/UX 设计
- 异步 API 调用（Fetch API）

## 数据流向图

```
┌─────────────────────────────────────────────────────────┐
│                    用户（浏览器）                          │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP 请求/响应
                     ↓
        ┌─────────────────────────┐
        │     前端应用             │
        │  (HTML/CSS/JavaScript)  │
        │                         │
        │  - 输入短信文本         │
        │  - 显示检测结果         │
        │  - 数据可视化           │
        └────────┬────────────────┘
                 │ REST API
                 ↓
    ┌────────────────────────────────┐
    │   Spring Boot 后端服务         │
    │   (REST API 服务器)            │
    │                                │
    │  - 接收检测请求                │
    │  - 调用 ML 服务                │
    │  - 保存检测记录                │
    │  - 提供统计数据                │
    └────┬──────────────────────┬────┘
         │                      │
    HTTP │                      │ JDBC
      请求│                      │
         ↓                      ↓
    ┌──────────────┐     ┌─────────────┐
    │ Python ML    │     │  MySQL      │
    │ Flask Service│     │  数据库      │
    │              │     │             │
    │ - 预处理文本 │     │ - 保存记录  │
    │ - 提取特征   │     │ - 统计数据  │
    │ - 分类预测   │     └─────────────┘
    └──────────────┘
```

## 数据库表结构

### sms_detection_record（检测记录表）

```sql
CREATE TABLE sms_detection_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sms_content LONGTEXT NOT NULL COMMENT '短信内容',
    classification INT NOT NULL COMMENT '分类结果：0=正常，1=垃圾',
    label VARCHAR(20) COMMENT '分类标签：normal/spam',
    confidence DOUBLE COMMENT '置信度：0-1',
    detection_time DATETIME COMMENT '检测时间',
    model_version VARCHAR(20) COMMENT '模型版本'
);
```

## 部署架构

### 开发环境
```
开发机
├── Python ML 服务 (localhost:5000)
├── Spring Boot 后端 (localhost:8080)
├── MySQL 数据库 (localhost:3306)
└── 前端应用 (本地文件或 localhost:8000)
```

### 生产环境
```
用户浏览器
    ↓
Nginx (反向代理, 80/443)
    ├→ CDN (静态资源)
    └→ Spring Boot (Java服务器)
         └→ Python ML (GPU服务器)
         └→ MySQL (数据库服务器)
```

## 常用命令

### Python ML 模块
```bash
# 进入目录
cd ml-model

# 安装依赖
pip install -r requirements.txt

# 训练模型
python src/train.py

# 启动 Flask API
python api_server.py

# 测试 API
curl http://localhost:5000/health
```

### Java 后端
```bash
# 进入目录
cd backend

# 清理和编译
mvn clean package

# 运行 JAR
java -jar target/spam-sms-detection-0.0.1-SNAPSHOT.jar

# Maven 直接运行
mvn spring-boot:run

# 查看日志
tail -f logs/spring.log
```

### 前端应用
```bash
# 进入目录
cd frontend

# 使用 Python 启动 Web 服务器
python -m http.server 8000

# 或使用 Node.js
npx http-server -p 8000

# 在浏览器访问
open http://localhost:8000
```

## 版本信息

| 组件 | 版本 | 用途 |
|------|------|------|
| Java | 8+ | 后端运行时 |
| Spring Boot | 2.7.0 | 框架 |
| MySQL | 8.0+ | 数据库 |
| Python | 3.8+ | ML 开发环境 |
| scikit-learn | 1.0.2 | ML 库 |
| Flask | 2.0.3 | API 框架 |
| ECharts | 5.3.0 | 数据可视化 |

## 文件编码

所有源代码文件使用 **UTF-8 编码**，确保中文字符正确显示。

## 性能指标

| 指标 | 目标值 | 实现方案 |
|------|--------|--------|
| 模型精确率 | > 95% | 大数据集 + 参数调优 |
| 单次预测延迟 | < 100ms | 模型优化 + 缓存 |
| API 响应时间 | < 500ms | 异步处理 + 连接池 |
| 并发请求 | > 100 | 线程池 + 数据库连接池 |

## 后续扩展建议

1. **模型优化**
   - [ ] 升级到 SVM 或随机森林
   - [ ] 增加特征工程
   - [ ] 使用深度学习（LSTM/BERT）

2. **功能增强**
   - [ ] 用户认证和授权
   - [ ] 短信分类细分（违法、营销、钓鱼等）
   - [ ] 模型在线学习
   - [ ] 多语言支持

3. **性能优化**
   - [ ] Redis 缓存
   - [ ] 异步处理
   - [ ] CDN 加速
   - [ ] 数据库优化

4. **运维部署**
   - [ ] Docker 容器化
   - [ ] Kubernetes 编排
   - [ ] 监控告警
   - [ ] 日志聚合

---

**⭐ 建议：** 首先按照 [QUICKSTART.md](QUICKSTART.md) 快速启动项目，然后根据需要查阅各模块的详细文档。
