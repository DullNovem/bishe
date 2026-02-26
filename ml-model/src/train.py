"""
模型训练脚本
"""

import pandas as pd
from sklearn.model_selection import train_test_split
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from utils import load_and_preprocess_data, FeatureExtractor, TextPreprocessor
from model import SpamClassifier


def main():
    data_file = 'ml-model\data\SMSSpamCollection'
    
    # 使用制表符作为分隔符读取，第一列为label(ham/spam)，第二列为text
    df = pd.read_csv(data_file, sep='\t', header=None, names=['label', 'text'])
    # 转换label：ham=0(正常), spam=1(垃圾)
    print(df.head())
    df['label'] = df['label'].map({'ham': 0, 'spam': 1})
    
    print(f"  ✓ 数据集加载完成，共 {len(df)} 条样本")
    print(f"    - 正常短信: {(df['label'] == 0).sum()} 条")
    print(f"    - 垃圾短信: {(df['label'] == 1).sum()} 条")
    
    # ========== 2. 文本预处理 ==========
    print("\n[2/5] 文本预处理...")
    preprocessor = TextPreprocessor(use_jieba=True)
    texts = preprocessor.preprocess_texts(df['text'].tolist())
    labels = df['label'].tolist()
    print(f"  ✓ 文本预处理完成")
    
    # ========== 3. 特征提取 ==========
    print("\n[3/5] 特征提取...")
    feature_extractor = FeatureExtractor(method='tfidf', max_features=3000)
    X = feature_extractor.fit_transform(texts)
    print(f"  ✓ 特征提取完成")
    print(f"    - 特征维度: {X.shape}")
    
    # ========== 4. 数据分割 ==========
    print("\n[4/5] 分割训练集和测试集...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, labels, test_size=0.2, random_state=42, stratify=labels
    )
    print(f"  ✓ 数据分割完成")
    print(f"    - 训练集大小: {X_train.shape[0]}")
    print(f"    - 测试集大小: {X_test.shape[0]}")
    
    # ========== 5. 模型训练与评估 ==========
    print("\n[5/5] 模型训练与评估...")
    classifier = SpamClassifier()
    classifier.set_vectorizer(feature_extractor.vectorizer)
    classifier.train(X_train, y_train)
    
    # 模型评估
    metrics = classifier.evaluate(X_test, y_test)
    
    print(f"  ✓ 模型训练完成")
    print(f"\n  模型性能指标:")
    print(f"    - 精确率 (Precision): {metrics['precision']:.4f}")
    print(f"    - 召回率 (Recall):    {metrics['recall']:.4f}")
    print(f"    - F1值:             {metrics['f1_score']:.4f}")
    print(f"\n  混淆矩阵:")
    print(f"    {metrics['confusion_matrix']}")
    print(f"\n  详细报告:")
    print(f"    {metrics['report']}")
    
    # ========== 6. 保存模型 ==========
    print("\n[6/6] 保存模型...")
    os.makedirs('model', exist_ok=True)
    classifier.save_model('model/spam_model.pkl', 'model/vectorizer.pkl')
    print(f"  ✓ 模型保存完成")
    
    # ========== 7. 测试预测 ==========
    print("\n" + "=" * 50)
    print("模型测试预测")
    print("=" * 50)
    
    test_cases = [
        "Your bank account has been suspended due to suspicious activity. Click here to verify immediately: bit.ly/xyz123",
        "CONGRATULATIONS! You have won a $1000 Walmart Gift Card. Claim your prize now before it expires: http://fake-site.com",
        "Hello dear, I found your profile and I think we are a perfect match. Chat with me here: [link]",
        "Loan Alert: You are pre-approved for a $50,000 loan with 1% interest. No credit check needed. Apply now!"
    ]
    
    for text in test_cases:
        result = classifier.predict_single(text)
        print(f"\n文本: {text}")
        print(f"结果: {result['label'].upper()}")
        print(f"置信度: {result['confidence']:.4f}")
        print(f"正常概率: {result['normal_prob']:.4f}, 垃圾概率: {result['spam_prob']:.4f}")
    
    print("\n" + "=" * 50)
    print("训练完成!")
    print("=" * 50)


if __name__ == '__main__':
    main()
