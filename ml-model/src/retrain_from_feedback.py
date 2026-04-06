import argparse
import os
import sys
from typing import List, Optional, Tuple

import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.dirname(__file__))

from model import SpamClassifier
from utils import FeatureExtractor, TextPreprocessor


def load_english_base() -> pd.DataFrame:
    candidate_paths = [
        os.path.join('ml-model', 'data', 'SMSSpamCollection'),
        os.path.join('ml-model', 'data', 'SMSSpamCollection.csv'),
        os.path.join('data', 'SMSSpamCollection'),
        os.path.join('data', 'SMSSpamCollection.csv'),
    ]
    data_file = next((path for path in candidate_paths if os.path.exists(path)), None)
    if not data_file:
        raise RuntimeError('English base dataset not found')

    df = pd.read_csv(
        data_file,
        sep='\t',
        header=None,
        names=['label', 'text'],
        encoding='utf-8',
        on_bad_lines='skip'
    )
    df['label'] = df['label'].map({'ham': 0, 'spam': 1})
    df.dropna(subset=['label', 'text'], inplace=True)
    df['label'] = df['label'].astype(int)
    return df[['label', 'text']]


def load_english_extra(file_path: str) -> pd.DataFrame:
    if not file_path or not os.path.exists(file_path):
        return pd.DataFrame(columns=['label', 'text'])

    rows = []
    with open(file_path, 'r', encoding='utf-8-sig') as handle:
        for raw in handle:
            line = raw.strip()
            if not line:
                continue
            parts = line.split('\t', 1)
            if len(parts) != 2:
                continue
            label_text, content = parts
            label = 1 if label_text.strip().lower() == 'spam' else 0
            rows.append({'label': label, 'text': content.strip()})
    return pd.DataFrame(rows, columns=['label', 'text'])


def load_chinese_base() -> pd.DataFrame:
    candidate_paths = [
        os.path.join('ml-model', 'data', 'zh_sms_spam.txt'),
        os.path.join('data', 'zh_sms_spam.txt'),
    ]
    data_file = next((path for path in candidate_paths if os.path.exists(path)), None)
    if not data_file:
        raise RuntimeError('Chinese base dataset not found')
    return load_chinese_extra(data_file)


def load_chinese_extra(file_path: str) -> pd.DataFrame:
    if not file_path or not os.path.exists(file_path):
        return pd.DataFrame(columns=['label', 'text'])

    rows = []
    with open(file_path, 'r', encoding='utf-8-sig') as handle:
        for raw in handle:
            line = raw.strip()
            if not line:
                continue
            parts = line.split('\t', 1)
            if len(parts) != 2:
                parts = line.split(None, 1)
            if len(parts) != 2:
                continue
            label_text, content = parts
            if label_text.strip() not in ('0', '1'):
                continue
            rows.append({'label': int(label_text.strip()), 'text': content.strip()})
    return pd.DataFrame(rows, columns=['label', 'text'])


def dedupe_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    clean = df.copy()
    clean['text'] = clean['text'].astype(str).str.strip()
    clean = clean[(clean['text'] != '') & clean['label'].isin([0, 1])]
    clean = clean.drop_duplicates(subset=['label', 'text']).reset_index(drop=True)
    return clean


def train_model(
    dataset: pd.DataFrame,
    model_path: str,
    vectorizer_path: str,
    use_jieba: bool
) -> Tuple[int, float, float, float]:
    if dataset.empty:
        raise RuntimeError('Training dataset is empty')

    labels = dataset['label'].tolist()
    if len(set(labels)) < 2:
        raise RuntimeError('Training dataset must contain both normal and spam samples')

    preprocessor = TextPreprocessor(use_jieba=use_jieba)
    texts = preprocessor.preprocess_texts(dataset['text'].tolist())
    feature_extractor = FeatureExtractor(method='tfidf', max_features=5000)
    features = feature_extractor.fit_transform(texts)

    test_size = 0.2 if len(dataset) >= 100 else 0.15
    X_train, X_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=test_size,
        random_state=42,
        stratify=labels
    )

    classifier = SpamClassifier()
    classifier.set_vectorizer(feature_extractor.vectorizer)
    classifier.train(X_train, y_train)
    metrics = classifier.evaluate(X_test, y_test)
    classifier.save_model(model_path, vectorizer_path)
    return len(dataset), metrics['precision'], metrics['recall'], metrics['f1_score']


def build_training_result(name: str, dataset: pd.DataFrame, metrics: Tuple[int, float, float, float]) -> str:
    sample_count, precision, recall, f1 = metrics
    return (
        f'{name}: samples={sample_count}, '
        f'precision={precision:.4f}, recall={recall:.4f}, f1={f1:.4f}'
    )


def main():
    parser = argparse.ArgumentParser(description='Retrain spam models with accepted feedback samples')
    parser.add_argument('--lang', choices=['en', 'zh', 'both'], default='both')
    parser.add_argument('--english-extra', dest='english_extra', default='')
    parser.add_argument('--chinese-extra', dest='chinese_extra', default='')
    args = parser.parse_args()

    messages: List[str] = []

    if args.lang in ('en', 'both'):
        english_dataset = dedupe_dataframe(
            pd.concat([load_english_base(), load_english_extra(args.english_extra)], ignore_index=True)
        )
        english_metrics = train_model(
            english_dataset,
            'model/en_spam_model.pkl',
            'model/en_vectorizer.pkl',
            use_jieba=False
        )
        messages.append(build_training_result('english', english_dataset, english_metrics))

    if args.lang in ('zh', 'both'):
        chinese_dataset = dedupe_dataframe(
            pd.concat([load_chinese_base(), load_chinese_extra(args.chinese_extra)], ignore_index=True)
        )
        chinese_metrics = train_model(
            chinese_dataset,
            'model/zh_spam_model.pkl',
            'model/zh_vectorizer.pkl',
            use_jieba=True
        )
        messages.append(build_training_result('chinese', chinese_dataset, chinese_metrics))

    print('RETRAIN_OK')
    for message in messages:
        print(message)


if __name__ == '__main__':
    main()
