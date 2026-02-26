"""
Flask API 服务
提供 REST API 接口供后端调用
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from model import SpamClassifier
from utils import TextPreprocessor

# 初始化Flask应用
app = Flask(__name__)
CORS(app)

# 初始化分类器
classifier = SpamClassifier('model/spam_model.pkl', 'model/vectorizer.pkl')

# 启动时加载模型
try:
    classifier.load_model()
    logger.info("模型加载成功")
except Exception as e:
    logger.warning(f"模型加载失败: {e}，请先运行 train.py 进行训练")


@app.route('/predict', methods=['POST'])
def predict():
    """
    垃圾短信检测接口
    
    请求格式:
    {
        "text": "要检测的短信内容"
    }
    
    响应格式:
    {
        "label": "spam" 或 "normal",
        "confidence": 0.95,
        "normal_prob": 0.05,
        "spam_prob": 0.95,
        "model_version": "1.0.0"
    }
    """
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        
        if not text:
            return jsonify({
                'code': 400,
                'message': '文本内容不能为空',
                'data': None
            }), 400
        
        # 进行预测
        result = classifier.predict_single(text)
        
        return jsonify({
            'code': 200,
            'message': 'success',
            'data': result
        }), 200
    
    except Exception as e:
        logger.error(f"预测失败: {str(e)}")
        return jsonify({
            'code': 500,
            'message': f'预测失败: {str(e)}',
            'data': None
        }), 500


@app.route('/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({
        'code': 200,
        'message': 'ML Service is running',
        'data': {
            'status': 'healthy',
            'model_loaded': classifier.model is not None
        }
    }), 200


@app.route('/info', methods=['GET'])
def info():
    """获取服务信息"""
    return jsonify({
        'code': 200,
        'message': 'success',
        'data': {
            'service_name': 'Spam SMS Detection ML Service',
            'version': '1.0.0',
            'model_version': classifier.model_version,
            'endpoints': [
                '/predict - 垃圾短信检测',
                '/health - 健康检查',
                '/info - 服务信息'
            ]
        }
    }), 200


@app.errorhandler(404)
def not_found(error):
    """处理404错误"""
    return jsonify({
        'code': 404,
        'message': '请求的端点不存在',
        'data': None
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """处理500错误"""
    return jsonify({
        'code': 500,
        'message': '服务器内部错误',
        'data': None
    }), 500


if __name__ == '__main__':
    logger.info("启动垃圾短信检测 ML 服务...")
    logger.info("服务运行在: http://localhost:5000")
    logger.info("API 文档: http://localhost:5000/info")
    app.run(host='0.0.0.0', port=5000, debug=False)
