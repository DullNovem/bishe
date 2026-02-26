"""
双语模型训练脚本
支持英文（SMSSpamCollection）和中文数据集
用法:
    python src/train.py --lang en    # 训练英文模型
    python src/train.py --lang zh    # 训练中文模型
    python src/train.py --lang both  # 训练两个模型（默认）
"""

import pandas as pd
from sklearn.model_selection import train_test_split
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(__file__))

from utils import FeatureExtractor, TextPreprocessor
from model import SpamClassifier


# ============================================================
# 中文 txt 数据集解析器
# 支持格式：每行以 0 或 1 开头，后跟制表符或若干空格，再跟短信内容
# 例：0\t[艺龙]12日北京晴-5-3度 南方航空CZ6127...
#     1   海南幼女开房案校长照片曝光...
# ============================================================
def _load_chinese_txt(file_path):
    records = []
    skipped = 0

    # 依次尝试常见编码
    content = None
    for encoding in ('utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'gb18030'):
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                content = f.readlines()
            print(f"  ✓ 文件编码识别为: {encoding}")
            break
        except UnicodeDecodeError:
            continue

    if content is None:
        raise RuntimeError(f"无法解码文件 {file_path}，请确认文件编码为 UTF-8 或 GBK")

    for i, line in enumerate(content, 1):
        # 去掉行尾换行符
        line = line.rstrip('\r\n')
        if not line.strip():
            continue  # 跳过空行

        # 优先按制表符切分
        if '\t' in line:
            parts = line.split('\t', 1)
        else:
            # 按任意空白字符切一次（split(None,1) 会处理多个空格/tab）
            parts = line.split(None, 1)

        if len(parts) < 2:
            skipped += 1
            if skipped <= 3:
                print(f"  ! 第{i}行只有一列，已跳过: {repr(line[:60])}")
            continue

        label_str = parts[0].strip()
        text = parts[1].strip()

        if label_str not in ('0', '1'):
            skipped += 1
            if skipped <= 3:
                print(f"  ! 第{i}行标签非0/1，已跳过: {repr(line[:60])}")
            continue

        if not text:
            skipped += 1
            continue

        records.append({'label': int(label_str), 'text': text})

    if skipped > 3:
        print(f"  ! 共跳过 {skipped} 行无效数据")

    if not records:
        raise RuntimeError("数据集解析结果为空，请检查文件格式是否符合要求")

    return pd.DataFrame(records)


# ============================================================
# 英文模型训练（基于 SMSSpamCollection）
# ============================================================
def train_english_model():
    print("\n" + "=" * 60)
    print("  训练英文垃圾短信模型")
    print("=" * 60)

    candidate_paths = [
        os.path.join('ml-model', 'data', 'SMSSpamCollection'),
        os.path.join('ml-model', 'data', 'SMSSpamCollection.csv'),
        os.path.join('data', 'SMSSpamCollection'),
        os.path.join('data', 'SMSSpamCollection.csv'),
    ]
    data_file = None
    for p in candidate_paths:
        if os.path.exists(p):
            data_file = p
            break

    if data_file is None:
        print("  ✗ 找不到英文数据集，请将 SMSSpamCollection 放在 ml-model/data/ 目录")
        return False

    df = pd.read_csv(data_file, sep='\t', header=None, names=['label', 'text'],
                     encoding='utf-8', on_bad_lines='skip')
    df['label'] = df['label'].map({'ham': 0, 'spam': 1})
    df.dropna(subset=['label', 'text'], inplace=True)
    df['label'] = df['label'].astype(int)

    print(f"  ✓ 数据集加载完成，共 {len(df)} 条样本")
    print(f"    - 正常短信(ham): {(df['label'] == 0).sum()} 条")
    print(f"    - 垃圾短信(spam): {(df['label'] == 1).sum()} 条")

    preprocessor = TextPreprocessor(use_jieba=False)
    texts = preprocessor.preprocess_texts(df['text'].tolist())
    labels = df['label'].tolist()
    print("  ✓ 文本预处理完成")

    feature_extractor = FeatureExtractor(method='tfidf', max_features=5000)
    X = feature_extractor.fit_transform(texts)
    print(f"  ✓ 特征提取完成，维度: {X.shape}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, labels, test_size=0.2, random_state=42, stratify=labels
    )

    classifier = SpamClassifier()
    classifier.set_vectorizer(feature_extractor.vectorizer)
    classifier.train(X_train, y_train)

    metrics = classifier.evaluate(X_test, y_test)
    print(f"\n  模型性能:")
    print(f"    精确率: {metrics['precision']:.4f}")
    print(f"    召回率: {metrics['recall']:.4f}")
    print(f"    F1值:   {metrics['f1_score']:.4f}")
    print(f"\n{metrics['report']}")

    os.makedirs('model', exist_ok=True)
    classifier.save_model('model/en_spam_model.pkl', 'model/en_vectorizer.pkl')
    print("  ✓ 英文模型已保存至 model/en_spam_model.pkl")

    print("\n  [ 测试样例 ]")
    test_cases = [
        ("WINNER!! You have been selected to receive a £900 prize. Call now!", "spam"),
        ("Hey, are you coming to the meeting at 3pm today?", "normal"),
        ("FREE entry in 2 a wkly comp to win FA Cup final tkts! Text FA to 87121", "spam"),
        ("I'll be home late tonight, don't wait up.", "normal"),
    ]
    for text, expected in test_cases:
        r = classifier.predict_single(text)
        flag = "✓" if r['label'] == expected else "✗"
        print(f"  {flag} [{r['label'].upper():6s} {r['confidence']:.2f}] {text[:60]}")

    return True


# ============================================================
# 中文模型训练
# ============================================================
def train_chinese_model():
    print("\n" + "=" * 60)
    print("  训练中文垃圾短信模型")
    print("=" * 60)

    candidate_paths = [
        os.path.join('ml-model', 'data', 'zh_sms_spam.txt'),
        os.path.join('data', 'zh_sms_spam.txt'),
    ]
    data_file = None
    for p in candidate_paths:
        if os.path.exists(p):
            data_file = p
            break

    if data_file is None:
        print("  ! 未找到中文数据集，将使用内置示例数据生成演示模型")
        print("    提示：将中文数据集命名为 zh_sms_spam.txt 放入 ml-model/data/")
        print("    格式：每行 [0或1][制表符或空格][短信内容]，无表头")
        df = _get_builtin_chinese_data()
    else:
        print(f"  ✓ 找到数据集: {data_file}")
        try:
            df = _load_chinese_txt(data_file)
        except Exception as e:
            print(f"  ✗ 数据集加载失败: {e}")
            return False

    print(f"  ✓ 数据集加载完成，共 {len(df)} 条样本")
    print(f"    - 正常短信(0): {(df['label'] == 0).sum()} 条")
    print(f"    - 垃圾短信(1): {(df['label'] == 1).sum()} 条")

    # 打印前3行预览，确认解析正确
    print("\n  [ 数据预览（前3行）]")
    for _, row in df.head(3).iterrows():
        print(f"    label={row['label']}  text={str(row['text'])[:60]}")

    # 文本预处理（中文使用 jieba 分词）
    preprocessor = TextPreprocessor(use_jieba=True)
    texts = preprocessor.preprocess_texts(df['text'].tolist())
    labels = df['label'].tolist()
    print("\n  ✓ 文本预处理完成（jieba 分词）")

    feature_extractor = FeatureExtractor(method='tfidf', max_features=5000)
    X = feature_extractor.fit_transform(texts)
    print(f"  ✓ 特征提取完成，维度: {X.shape}")

    test_size = 0.2 if len(df) >= 100 else 0.15
    X_train, X_test, y_train, y_test = train_test_split(
        X, labels, test_size=test_size, random_state=42, stratify=labels
    )

    classifier = SpamClassifier()
    classifier.set_vectorizer(feature_extractor.vectorizer)
    classifier.train(X_train, y_train)

    metrics = classifier.evaluate(X_test, y_test)
    print(f"\n  模型性能:")
    print(f"    精确率: {metrics['precision']:.4f}")
    print(f"    召回率: {metrics['recall']:.4f}")
    print(f"    F1值:   {metrics['f1_score']:.4f}")
    print(f"\n{metrics['report']}")

    os.makedirs('model', exist_ok=True)
    classifier.save_model('model/zh_spam_model.pkl', 'model/zh_vectorizer.pkl')
    print("  ✓ 中文模型已保存至 model/zh_spam_model.pkl")

    print("\n  [ 测试样例 ]")
    test_cases = [
        ("恭喜您！您已被选中获得10000元大奖，请立即点击链接领取", "spam"),
        ("妈，我今晚加班，晚点回家，不用等我吃饭", "normal"),
        ("【贷款提醒】您有5万元贷款额度，无需抵押，立即申请！", "spam"),
        ("明天下午两点会议室开会，请准时参加", "normal"),
        ("您的包裹已到达，请前往快递站取件", "normal"),
        ("点击领取优惠券，限时免费，过期作废！", "spam"),
    ]
    for text, expected in test_cases:
        r = classifier.predict_single(text)
        flag = "✓" if r['label'] == expected else "✗"
        print(f"  {flag} [{r['label'].upper():6s} {r['confidence']:.2f}] {text[:40]}")

    return True


# ============================================================
# 内置中文示例数据（无外部数据集时使用）
# ============================================================
def _get_builtin_chinese_data():
    spam_samples = [
        "恭喜您中奖了，奖金10000元，点击领取",
        "您好，我们提供小额贷款，无抵押，当天放款",
        "【招聘】日入500元，在家就能做，联系我",
        "您的信用卡额度已提升，点击激活享受优惠",
        "免费领取iPhone，仅限前100名",
        "恭喜！您被选中参与我们的抽奖活动",
        "低价出售名牌包包手表，正品保证",
        "快速贷款，征信不好也能办，利息低",
        "中奖通知：您获得了一等奖，请配合缴纳手续费",
        "全国招代理，月入过万，轻松创业",
        "您的快递有问题，点击链接重新填写地址",
        "【紧急通知】您的银行卡异常，立即验证",
        "优惠活动：充值100送200，限时抢购",
        "高薪兼职，每天3小时，月赚8000元",
        "您好，您申请的贷款已审核通过，立即提现",
        "点击领取本月话费补贴100元",
        "祝贺！您已通过资格审核，可领取补贴5000元",
        "网贷逾期？我们帮您协商减免利息",
        "微商招募，免费培训，轻松赚钱",
        "您的账号涉嫌违规，点击申诉否则封号",
        "出售学历证书、驾照、资格证",
        "代开发票，增值税专票，联系电话",
        "专业刷单，零风险，日收入200到500元",
        "免费体验课名额有限，快来报名",
        "温馨提示：您的积分即将过期，速兑换",
        "私家侦探，专业调查出轨，保密服务",
        "机票酒店特价，全程最低价，立即预订",
        "购买我们的产品，让您减肥成功，无效退款",
        "有偿问卷调查，填写完成得50元红包",
        "恭喜您成为我们的VIP会员，专属福利等您",
    ]
    normal_samples = [
        "妈妈，我今天加班，晚点回家，不用等我吃饭",
        "明天下午两点在会议室开会，请准时参加",
        "你昨天落下的雨伞我帮你拿着了",
        "今天天气不错，要不要一起去爬山",
        "超市打折，牛奶酸奶都有优惠，需要帮你带吗",
        "学校通知：本周五下午提前放学",
        "你的快递已签收，感谢使用顺丰",
        "晚上有空吗？一起去看那部新电影",
        "药已经买到了，记得按时吃",
        "作业提交截止今晚12点，别忘了",
        "水电费已缴，本月共计183元",
        "爸，我到了，不用担心",
        "下周一到周三出差北京，有事电话联系",
        "车已修好，可以来取了",
        "生日快乐！希望你今天过得开心",
        "图书馆的书还书日期是本周五",
        "公司年会定在12月28日，请确认出席",
        "宝贝，今天吃什么？我来做饭",
        "快递柜取件码：54321，有效期24小时",
        "医院复查结果出来了，一切正常，放心",
        "地铁延误20分钟，我晚点到",
        "合同已签好，请查收附件",
        "感谢您的购物，如有问题请联系客服",
        "孩子今天在学校表现很好",
        "通知：本楼道停水2小时，请提前储水",
        "明天去打疫苗，记得带身份证",
        "停车费已缴，月卡有效期至下月底",
        "麻烦帮我带一份炒饭，谢谢",
        "会议纪要已发到邮箱，请查收",
        "周末家庭聚餐，时间地点确认一下",
    ]
    data = (
        [{'label': 1, 'text': t} for t in spam_samples] +
        [{'label': 0, 'text': t} for t in normal_samples]
    )
    return pd.DataFrame(data)


# ============================================================
# 主入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='垃圾短信模型训练脚本')
    parser.add_argument('--lang', type=str, default='both',
                        choices=['en', 'zh', 'both'],
                        help='训练语言: en=英文, zh=中文, both=两个（默认）')
    args = parser.parse_args()

    results = {}

    if args.lang in ('en', 'both'):
        results['en'] = train_english_model()

    if args.lang in ('zh', 'both'):
        results['zh'] = train_chinese_model()

    print("\n" + "=" * 60)
    print("训练结果汇总")
    print("=" * 60)
    for lang, ok in results.items():
        name = "英文模型" if lang == 'en' else "中文模型"
        status = "✓ 成功" if ok else "✗ 失败"
        print(f"  {name}: {status}")
    print("=" * 60)
    print("\n完成！可以运行 python api_server.py 启动服务")


if __name__ == '__main__':
    main()