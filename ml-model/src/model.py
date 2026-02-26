"""
机器学习模型定义和预测接口
"""

import joblib
import numpy as np
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, classification_report
import os

class SpamClassifier:
    """垃圾短信分类器"""
     
    def __init__(self, model_path='model/spam_model.pkl', vectorizer_path='model/vectorizer.pkl'):
        """
        初始化分类器
        :param model_path: 模型文件路径
        :param vectorizer_path: 向量化器文件路径
        """
        self.model_path = model_path
        self.vectorizer_path = vectorizer_path
        self.model = None
        self.vectorizer = None
        self.model_version = "1.0.0"
        
        if os.path.exists(model_path) and os.path.exists(vectorizer_path):
            self.load_model()
    
    def train(self, X_train, y_train):
        """
        训练模型
        :param X_train: 训练特征矩阵
        :param y_train: 训练标签
        """
        self.model = MultinomialNB(alpha=0.1)
        self.model.fit(X_train, y_train)
    
    def predict(self, X):
        """
        预测
        :param X: 特征矩阵
        :return: 预测标签
        """
        if self.model is None:
            raise ValueError("模型未加载或训练")
        return self.model.predict(X)
    
    def predict_proba(self, X):
        """
        获取预测概率
        :param X: 特征矩阵
        :return: 各类别概率
        """
        if self.model is None:
            raise ValueError("模型未加载或训练")
        return self.model.predict_proba(X)
    
    def predict_single(self, text):
        """
        预测单条文本
        :param text: 输入文本
        :return: (预测标签, 置信度, 各类别概率)
        """
        if self.vectorizer is None:
            raise ValueError("向量化器未加载")
        
        X = self.vectorizer.transform([text])
        prediction = self.predict(X)[0]
        probabilities = self.predict_proba(X)[0]
        
        # 0=正常, 1=垃圾
        label = "spam" if prediction == 1 else "normal"
        confidence = probabilities[prediction]
        
        return {
            'label': label,
            'confidence': float(confidence),
            'normal_prob': float(probabilities[0]),
            'spam_prob': float(probabilities[1]),
            'model_version': self.model_version
        }
    
    def evaluate(self, X_test, y_test):
        """
        模型评估
        :param X_test: 测试特征矩阵
        :param y_test: 测试标签
        :return: 评估指标字典
        """
        if self.model is None:
            raise ValueError("模型未加载或训练")
        
        y_pred = self.predict(X_test)
        
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        cm = confusion_matrix(y_test, y_pred)
        report = classification_report(y_test, y_pred)
        
        return {
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'confusion_matrix': cm,
            'report': report
        }
    
    def save_model(self, model_path=None, vectorizer_path=None):
        """
        保存模型
        :param model_path: 模型文件路径
        :param vectorizer_path: 向量化器文件路径
        """
        model_path = model_path or self.model_path
        vectorizer_path = vectorizer_path or self.vectorizer_path
        
        if self.model is None:
            raise ValueError("模型未训练")
        
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        os.makedirs(os.path.dirname(vectorizer_path), exist_ok=True)
        
        joblib.dump(self.model, model_path)
        joblib.dump(self.vectorizer, vectorizer_path)
        print(f"模型已保存到: {model_path}, {vectorizer_path}")
    
    def load_model(self, model_path=None, vectorizer_path=None):
        """
        加载模型
        :param model_path: 模型文件路径
        :param vectorizer_path: 向量化器文件路径
        """
        model_path = model_path or self.model_path
        vectorizer_path = vectorizer_path or self.vectorizer_path
        
        self.model = joblib.load(model_path)
        self.vectorizer = joblib.load(vectorizer_path)
        print(f"模型已加载从: {model_path}, {vectorizer_path}")
    
    def set_vectorizer(self, vectorizer):
        """设置向量化器"""
        self.vectorizer = vectorizer
