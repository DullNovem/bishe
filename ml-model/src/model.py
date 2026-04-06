import os

import joblib
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.naive_bayes import MultinomialNB


class SpamClassifier:
    def __init__(self, model_path="model/spam_model.pkl", vectorizer_path="model/vectorizer.pkl"):
        self.model_path = model_path
        self.vectorizer_path = vectorizer_path
        self.model = None
        self.vectorizer = None
        self.model_version = "1.0.0"

        if os.path.exists(model_path) and os.path.exists(vectorizer_path):
            self.load_model()

    def train(self, x_train, y_train):
        self.model = MultinomialNB(alpha=0.1)
        self.model.fit(x_train, y_train)

    def predict(self, x):
        if self.model is None:
            raise ValueError("模型未加载或未训练")
        return self.model.predict(x)

    def predict_proba(self, x):
        if self.model is None:
            raise ValueError("模型未加载或未训练")
        return self.model.predict_proba(x)

    def predict_single(self, text):
        if self.model is None or self.vectorizer is None:
            raise ValueError("模型或向量器未加载")

        x = self.vectorizer.transform([text])
        prediction = int(self.predict(x)[0])
        probabilities = self.predict_proba(x)[0]

        return {
            "label": "spam" if prediction == 1 else "normal",
            "confidence": float(probabilities[prediction]),
            "normal_prob": float(probabilities[0]),
            "spam_prob": float(probabilities[1]),
            "model_version": self.model_version,
        }

    def evaluate(self, x_test, y_test):
        if self.model is None:
            raise ValueError("模型未加载或未训练")

        y_pred = self.predict(x_test)
        return {
            "precision": precision_score(y_test, y_pred, zero_division=0),
            "recall": recall_score(y_test, y_pred, zero_division=0),
            "f1_score": f1_score(y_test, y_pred, zero_division=0),
            "confusion_matrix": confusion_matrix(y_test, y_pred),
            "report": classification_report(y_test, y_pred, zero_division=0),
        }

    def save_model(self, model_path=None, vectorizer_path=None):
        model_path = model_path or self.model_path
        vectorizer_path = vectorizer_path or self.vectorizer_path

        if self.model is None or self.vectorizer is None:
            raise ValueError("模型或向量器未初始化")

        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        os.makedirs(os.path.dirname(vectorizer_path), exist_ok=True)
        joblib.dump(self.model, model_path)
        joblib.dump(self.vectorizer, vectorizer_path)

    def load_model(self, model_path=None, vectorizer_path=None):
        model_path = model_path or self.model_path
        vectorizer_path = vectorizer_path or self.vectorizer_path
        self.model = joblib.load(model_path)
        self.vectorizer = joblib.load(vectorizer_path)

    def set_vectorizer(self, vectorizer):
        self.vectorizer = vectorizer
