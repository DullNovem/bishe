from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import os
import sys


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(BASE_DIR, "src")
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from model import SpamClassifier  # noqa: E402


app = Flask(__name__)
CORS(app)


def model_path(*parts: str) -> str:
    return os.path.join(BASE_DIR, *parts)


en_classifier = SpamClassifier(
    model_path("model", "en_spam_model.pkl"),
    model_path("model", "en_vectorizer.pkl"),
)
zh_classifier = SpamClassifier(
    model_path("model", "zh_spam_model.pkl"),
    model_path("model", "zh_vectorizer.pkl"),
)


def load_all_models() -> dict:
    reloaded = {"en": False, "zh": False}
    errors = {}

    for lang, classifier in (("en", en_classifier), ("zh", zh_classifier)):
        try:
            classifier.load_model()
            reloaded[lang] = True
            logger.info("%s model loaded", lang)
        except Exception as exc:
            errors[lang] = str(exc)
            logger.exception("failed to load %s model", lang)

    return {"reloaded": reloaded, "errors": errors}


def get_classifier(lang: str) -> SpamClassifier:
    return zh_classifier if lang == "zh" else en_classifier


load_all_models()


@app.route("/predict", methods=["POST"])
def predict():
    try:
        payload = request.get_json(silent=True) or {}
        text = str(payload.get("text", "")).strip()
        lang = str(payload.get("lang", "en")).strip().lower()
        if lang not in ("en", "zh"):
            lang = "en"

        if not text:
            return jsonify({"code": 400, "message": "文本内容不能为空", "data": None}), 400

        classifier = get_classifier(lang)
        if classifier.model is None or classifier.vectorizer is None:
            return jsonify({
                "code": 503,
                "message": f"{'中文' if lang == 'zh' else '英文'}模型尚未加载",
                "data": None
            }), 503

        result = classifier.predict_single(text)
        result["lang"] = lang
        return jsonify({"code": 200, "message": "success", "data": result}), 200
    except Exception as exc:
        logger.exception("prediction failed")
        return jsonify({"code": 500, "message": f"预测失败: {exc}", "data": None}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "code": 200,
        "message": "ML Service is running",
        "data": {
            "status": "healthy",
            "en_model_loaded": en_classifier.model is not None and en_classifier.vectorizer is not None,
            "zh_model_loaded": zh_classifier.model is not None and zh_classifier.vectorizer is not None
        }
    }), 200


@app.route("/reload-models", methods=["POST"])
def reload_models():
    result = load_all_models()
    success = all(result["reloaded"].values())
    status = 200 if success else 500
    return jsonify({
        "code": status,
        "message": "success" if success else "reload failed",
        "data": result
    }), status


@app.route("/info", methods=["GET"])
def info():
    return jsonify({
        "code": 200,
        "message": "success",
        "data": {
            "service_name": "Spam SMS Detection ML Service",
            "version": "2.0.0",
            "supported_languages": ["en", "zh"],
            "endpoints": [
                "/predict - 垃圾短信检测",
                "/health - 健康检查",
                "/reload-models - 热加载模型",
                "/info - 服务信息"
            ]
        }
    }), 200


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"code": 404, "message": "请求的端点不存在", "data": None}), 404


@app.errorhandler(500)
def internal_error(_error):
    return jsonify({"code": 500, "message": "服务器内部错误", "data": None}), 500


if __name__ == "__main__":
    logger.info("starting spam sms detection ml service")
    logger.info("service url: http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
