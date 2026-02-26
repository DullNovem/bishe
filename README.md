# 垃圾短信识别系统

## 项目概述
这是一套基于机器学习的垃圾短信自动识别系统，采用前后端分离架构，集成了朴素贝叶斯分类算法和现代化的Web应用。

## 项目结构

```
bishe/
├── backend/           # Spring Boot 后端服务
├── ml-model/          # Python 机器学习模块
├── frontend/          # 前端应用
└── README.md
```

## 技术栈

### 后端
- Java 8+
- Spring Boot 2.7+
- MySQL 8.0
- MyBatis-Plus

### 机器学习
- Python 3.8+
- scikit-learn
- pandas
- jieba (中文分词)
- flask (模型API)

### 前端
- HTML5
- CSS3
- JavaScript (原生)
- ECharts (数据可视化)

## 快速开始

### 1. 机器学习模块配置
```bash
cd ml-model
pip install -r requirements.txt
python src/train.py  # 训练模型
python api_server.py #启动flask
```

### 2. 后端服务配置
```bash
cd backend
mvn clean package
java -jar target/spam-sms-detection-0.0.1-SNAPSHOT.jar
```

### 3. 前端部署
启动后端后，访问 `http://localhost :8080`

## 模块说明

### ml-model（数据处理与模型训练）
- **train.py**: 模型训练主程序
- **model.py**: 模型定义和预测接口
- **utils.py**: 文本预处理工具函数
- **data/**: 数据集存放目录

### backend（Spring Boot后端）
- **controller**: REST API 控制器
- **service**: 业务逻辑层
- **entity**: 数据实体类
- **repository**: 数据库访问层

### frontend（前端应用）
- **index.html**: 主页面
- **style.css**: 样式表
- **script.js**: 交互逻辑

## 功能特性

- ✅ 垃圾短信智能识别
- ✅ 实时分类结果展示
- ✅ 置信度概率显示
- ✅ 检测历史记录
- ✅ 仪表板数据统计
- ✅ 垃圾/正常短信比例分析


