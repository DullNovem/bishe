"""
Flask API 服务
提供 REST API 接口供后端调用
支持中文和英文双模型切换
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

# ========== 初始化双模型 ==========
# 英文模型
en_classifier = SpamClassifier('model\en_spam_model.pkl', 'model\en_vectorizer.pkl')
# 中文模型
zh_classifier = SpamClassifier('model\zh_spam_model.pkl', 'model\zh_vectorizer.pkl')

# 启动时加载模型
for lang, clf, label in [('English', en_classifier, 'en'), ('Chinese', zh_classifier, 'zh')]:
    try:
        clf.load_model()
        logger.info(f"{lang} 模型加载成功")
    except Exception as e:
        logger.warning(f"{lang} 模型加载失败: {e}，请先运行对应的训练脚本")


def get_classifier(lang: str):
    """根据语言参数返回对应分类器"""
    if lang == 'zh':
        return zh_classifier
    return en_classifier  # 默认英文


@app.route('/predict', methods=['POST'])
def predict():
    """
    垃圾短信检测接口

    请求格式:
    {
        "text": "要检测的短信内容",
        "lang": "en" 或 "zh"   # 可选，默认 "en"
    }

    响应格式:
    {
        "label": "spam" 或 "normal",
        "confidence": 0.95,
        "normal_prob": 0.05,
        "spam_prob": 0.95,
        "model_version": "1.0.0",
        "lang": "en"
    }
    """
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        lang = data.get('lang', 'en').strip().lower()

        if lang not in ('en', 'zh'):
            lang = 'en'

        if not text:
            return jsonify({
                'code': 400,
                'message': '文本内容不能为空',
                'data': None
            }), 400

        clf = get_classifier(lang)

        if clf.model is None:
            return jsonify({
                'code': 503,
                'message': f'{"中文" if lang == "zh" else "英文"}模型尚未加载，请先运行训练脚本',
                'data': None
            }), 503

        result = clf.predict_single(text)
        result['lang'] = lang

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
            'en_model_loaded': en_classifier.model is not None,
            'zh_model_loaded': zh_classifier.model is not None
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
            'version': '2.0.0',
            'supported_languages': ['en', 'zh'],
            'endpoints': [
                '/predict - 垃圾短信检测（支持 lang 参数: en/zh）',
                '/health - 健康检查',
                '/info - 服务信息'
            ]
        }
    }), 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({'code': 404, 'message': '请求的端点不存在', 'data': None}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'code': 500, 'message': '服务器内部错误', 'data': None}), 500


if __name__ == '__main__':
    logger.info("启动垃圾短信检测 ML 服务（双语版）...")
    logger.info("服务运行在: http://localhost:5000")
    logger.info("支持语言: 英文(en) / 中文(zh)")
    app.run(host='0.0.0.0', port=5000, debug=False)