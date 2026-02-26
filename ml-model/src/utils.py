"""
文本预处理工具函数
"""

import re
import jieba
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer

class TextPreprocessor:
    """文本预处理类"""
    
    def __init__(self, use_jieba=True):
        """
        初始化预处理器
        :param use_jieba: 是否使用结巴分词（针对中文），否则使用空格分词
        """
        self.use_jieba = use_jieba
    
    @staticmethod
    def clean_text(text):
        """
        清理文本：去除特殊符号、URL等
        :param text: 输入文本
        :return: 清理后的文本
        """
        # 转换为小写
        text = text.lower()
        
        # 去除URL
        text = re.sub(r'http\S+|www\.\S+', '', text)
        
        # 去除邮箱
        text = re.sub(r'\S+@\S+', '', text)
        
        # 去除特殊符号，只保留中英文、数字和空格
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', '', text)
        
        # 去除多余空格
        text = ' '.join(text.split())
        
        return text
    
    def tokenize(self, text):
        """
        分词
        :param text: 输入文本
        :return: 分词结果（字符串）
        """
        text = self.clean_text(text)
        
        if self.use_jieba:
            # 使用结巴分词进行中文分词
            tokens = jieba.cut(text)
            return ' '.join(tokens)
        else:
            # 使用空格分词
            return text
    
    def preprocess_texts(self, texts):
        """
        批量预处理文本
        :param texts: 文本列表
        :return: 预处理后的文本列表
        """
        return [self.tokenize(text) for text in texts]


class FeatureExtractor:
    """特征提取类"""
    
    def __init__(self, method='tfidf', max_features=3000):
        """
        初始化特征提取器
        :param method: 特征提取方法 ('tfidf' 或 'count')
        :param max_features: 最大特征数量
        """
        self.method = method
        self.max_features = max_features
        self.vectorizer = None
        
        if method == 'tfidf':
            self.vectorizer = TfidfVectorizer(
                max_features=max_features,
                min_df=2,
                max_df=0.8,
                ngram_range=(1, 2)
            )
        else:
            self.vectorizer = CountVectorizer(
                max_features=max_features,
                min_df=2,
                max_df=0.8,
                ngram_range=(1, 2)
            )
    
    def fit_transform(self, texts):
        """
        拟合并转换文本为特征向量
        :param texts: 文本列表
        :return: 特征矩阵
        """
        return self.vectorizer.fit_transform(texts)
    
    def transform(self, texts):
        """
        将文本转换为特征向量
        :param texts: 文本列表
        :return: 特征矩阵
        """
        return self.vectorizer.transform(texts)
    
    def get_feature_names(self):
        """获取特征名称"""
        return self.vectorizer.get_feature_names_out()


def load_and_preprocess_data(file_path, text_column='text', label_column='label'):
    """
    加载和预处理数据
    :param file_path: CSV文件路径
    :param text_column: 文本列名
    :param label_column: 标签列名
    :return: (预处理后的文本, 标签)
    """
    # 加载数据
    df = pd.read_csv(file_path)
    
    # 文本预处理
    preprocessor = TextPreprocessor(use_jieba=True)
    texts = preprocessor.preprocess_texts(df[text_column].tolist())
    labels = df[label_column].tolist()
    
    return texts, labels
