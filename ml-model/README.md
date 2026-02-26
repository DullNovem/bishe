# Python ML 模块说明

## 目录结构

```
ml-model/
├── src/
│   ├── train.py          # 模型训练脚本
│   ├── model.py          # 模型定义和预测接口
│   └── utils.py          # 文本预处理和特征提取工具
├── data/
│   └── SMSSpamCollection.csv   # 数据集
├── model/
│   ├── spam_model.pkl    # 训练好的模型
│   └── vectorizer.pkl    # 特征向量化器
├── api_server.py         # Flask API 服务
├── requirements.txt      # Python 依赖
└── README.md            # 说明文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 训练模型

```bash
python src/train.py
```

这将：
- 加载数据集
- 进行文本预处理
- 提取特征向量
- 训练朴素贝叶斯分类器
- 保存模型和向量化器

### 3. 启动 API 服务

```bash
python api_server.py
```

服务将运行在 `http://localhost:5000`

## API 接口

### 1. 预测接口

**POST** `/predict`

请求:
```json
{
  "text": "恭喜你中了大奖，请点击链接领取"
}
```

响应:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "label": "spam",
    "confidence": 0.95,
    "normal_prob": 0.05,
    "spam_prob": 0.95,
    "model_version": "1.0.0"
  }
}
```

### 2. 健康检查

**GET** `/health`

响应:
```json
{
  "code": 200,
  "message": "ML Service is running",
  "data": {
    "status": "healthy",
    "model_loaded": true
  }
}
```

### 3. 服务信息

**GET** `/info`

响应:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "service_name": "Spam SMS Detection ML Service",
    "version": "1.0.0",
    "model_version": "1.0.0",
    "endpoints": [...]
  }
}
```

## 模块说明

### model.py
- `SpamClassifier`: 主要的分类器类
  - `train()`: 训练模型
  - `predict()`: 批量预测
  - `predict_proba()`: 获取概率
  - `predict_single()`: 单条预测
  - `evaluate()`: 模型评估
  - `save_model()`: 保存模型
  - `load_model()`: 加载模型

### utils.py
- `TextPreprocessor`: 文本预处理
  - `clean_text()`: 清理文本
  - `tokenize()`: 分词
  - `preprocess_texts()`: 批量预处理

- `FeatureExtractor`: 特征提取
  - `fit_transform()`: 拟合和转换
  - `transform()`: 转换文本
  - `get_feature_names()`: 获取特征名称

## 数据集格式

CSV 文件应包含以下列:
- `label`: 分类标签 (0=正常, 1=垃圾)
- `text`: 短信文本内容

示例:
```
label,text
0,你好，今天天气真好
1,恭喜你中了大奖，立即领取
0,会议时间改到下午3点
```

## 模型算法

- **算法**: 多项式朴素贝叶斯 (Multinomial Naive Bayes)
- **特征提取**: TF-IDF
- **文本分词**: 结巴分词 (中文) / 空格分词 (英文)
- **分类**: 二分类 (0=正常, 1=垃圾)

## 性能指标

模型会输出以下性能指标:
- **Precision**: 精确率 - 预测为垃圾的中有多少真的是垃圾
- **Recall**: 召回率 - 所有垃圾短信中有多少被成功识别
- **F1 Score**: F1值 - 精确率和召回率的调和平均数

## 故障排除

### 模型无法加载
如果看到 "模型加载失败" 的警告:
1. 确保已运行 `python src/train.py` 来生成模型文件
2. 检查 `model/` 目录是否存在 `spam_model.pkl` 和 `vectorizer.pkl`

### 预测结果不准确
1. 确保数据集包含足够的垃圾短信样本
2. 尝试调整模型参数（在 `model.py` 中的 `alpha` 参数）
3. 使用更大的数据集进行训练

## 许可证
MIT
