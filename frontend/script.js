// ========== 配置 ==========
const API_BASE_URL = 'http://localhost:8080/api';
const STATS_REFRESH_INTERVAL = 5000;

// ========== 状态 ==========
let currentLang = 'en'; // 当前语言: 'en' 或 'zh'

// ========== DOM 元素 ==========
const smsInput = document.getElementById('smsInput');
const charCount = document.getElementById('charCount');
const detectBtn = document.getElementById('detectBtn');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const historyTableBody = document.getElementById('historyTableBody');

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function () {
    initializeEventListeners();
    loadStatistics();
    setInterval(loadStatistics, STATS_REFRESH_INTERVAL);
});

// ========== 语言切换 ==========
function switchLang(lang) {
    currentLang = lang;

    // 更新按钮样式
    document.getElementById('btnLangEn').classList.toggle('active', lang === 'en');
    document.getElementById('btnLangZh').classList.toggle('active', lang === 'zh');

    // 更新提示文字
    const tip = document.getElementById('langTip');
    if (lang === 'zh') {
        tip.textContent = '当前使用中文模型';
        tip.className = 'lang-tip lang-tip-zh';
        smsInput.placeholder = '请输入要检测的中文短信内容...';
    } else {
        tip.textContent = '当前使用英文模型';
        tip.className = 'lang-tip lang-tip-en';
        smsInput.placeholder = 'Enter the SMS content to detect (English)...';
    }

    // 清除旧结果
    resultContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    smsInput.value = '';
    charCount.textContent = '0';
}

// ========== 事件监听器 ==========
function initializeEventListeners() {
    detectBtn.addEventListener('click', handleDetection);
    smsInput.addEventListener('input', updateCharCount);
    smsInput.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            handleDetection();
        }
    });
}

// ========== 短信检测功能 ==========
async function handleDetection() {
    const content = smsInput.value.trim();

    if (!content) {
        showError(currentLang === 'zh' ? '请输入要检测的短信内容' : 'Please enter SMS content to detect');
        return;
    }

    if (content.length > 500) {
        showError('短信内容不能超过500个字符');
        return;
    }

    resultContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    loadingContainer.style.display = 'block';
    detectBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/detection/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, lang: currentLang })
        });

        const data = await response.json();

        if (response.ok && data.code === 200) {
            displayResult(data.data);
            addToHistory(content, data.data);
            loadStatistics();
        } else {
            showError(data.message || '检测失败，请稍后重试');
        }
    } catch (error) {
        console.error('检测错误:', error);
        showError('网络错误，请检查后端服务是否运行');
    } finally {
        loadingContainer.style.display = 'none';
        detectBtn.disabled = false;
    }
}

// ========== 显示检测结果 ==========
function displayResult(result) {
    errorContainer.style.display = 'none';
    resultContainer.style.display = 'block';

    const resultLabel = document.getElementById('resultLabel');
    const isSpam = result.label === 'spam';
    resultLabel.className = `result-label ${result.label}`;
    resultLabel.textContent = isSpam ? '🚫 垃圾短信' : '✅ 正常短信';

    document.getElementById('resultText').textContent = isSpam ? '垃圾短信' : '正常短信';
    document.getElementById('resultConfidence').textContent =
        (result.confidence * 100).toFixed(2) + '%';
    document.getElementById('resultNormalProb').textContent =
        (result.normalProbability * 100).toFixed(2) + '%';
    document.getElementById('resultSpamProb').textContent =
        (result.spamProbability * 100).toFixed(2) + '%';

    // 语言模型标识
    const langBadge = document.getElementById('resultLangBadge');
    const lang = result.lang || currentLang;
    if (lang === 'zh') {
        langBadge.textContent = '🇨🇳 中文模型';
        langBadge.className = 'detail-value lang-badge lang-badge-zh';
    } else {
        langBadge.textContent = '🇺🇸 英文模型';
        langBadge.className = 'detail-value lang-badge lang-badge-en';
    }

    drawProbabilityChart(result.normalProbability, result.spamProbability);
}

// ========== 绘制概率柱状图 ==========
function drawProbabilityChart(normalProb, spamProb) {
    const chartElement = document.getElementById('probabilityChart');
    const myChart = echarts.init(chartElement);

    const option = {
        title: {
            text: '分类概率分布',
            left: 'center',
            textStyle: { color: '#333', fontSize: 14, fontWeight: 'bold' }
        },
        tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
        grid: { left: '10%', right: '10%', bottom: '10%', top: '30%', containLabel: true },
        xAxis: {
            type: 'category',
            data: ['正常短信', '垃圾短信'],
            axisLine: { lineStyle: { color: '#ddd' } }
        },
        yAxis: {
            type: 'value', min: 0, max: 100,
            axisLine: { lineStyle: { color: '#ddd' } }
        },
        series: [{
            data: [(normalProb * 100).toFixed(2), (spamProb * 100).toFixed(2)],
            type: 'bar',
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#84fab0' },
                    { offset: 1, color: '#8fd3f4' }
                ])
            },
            barMaxWidth: '60%'
        }]
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
}

// ========== 统计数据功能 ==========
async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/statistics`);
        const data = await response.json();

        if (response.ok && data.code === 200) {
            updateStatisticsDisplay(data.data);
            drawPieChart(data.data);
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

function updateStatisticsDisplay(stats) {
    document.getElementById('totalDetections').textContent = stats.totalDetections || 0;
    document.getElementById('spamCount').textContent = stats.spamCount || 0;
    document.getElementById('normalCount').textContent = stats.normalCount || 0;
}

// ========== 绘制饼图 ==========
function drawPieChart(stats) {
    const chartElement = document.getElementById('pieChart');
    const myChart = echarts.init(chartElement);

    const spamCount = stats.spamCount || 0;
    const normalCount = stats.normalCount || 0;

    const option = {
        title: {
            text: '垃圾/正常短信比例',
            left: 'center',
            textStyle: { color: '#333', fontSize: 14, fontWeight: 'bold' }
        },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left', textStyle: { color: '#666' } },
        series: [{
            name: '短信分类',
            type: 'pie',
            radius: '50%',
            data: [
                {
                    value: normalCount,
                    name: '正常短信',
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#84fab0' },
                            { offset: 1, color: '#8fd3f4' }
                        ])
                    }
                },
                {
                    value: spamCount,
                    name: '垃圾短信',
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#fa709a' },
                            { offset: 1, color: '#fee140' }
                        ])
                    }
                }
            ],
            emphasis: {
                itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
            }
        }]
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
}

// ========== 历史记录功能 ==========
let detectionHistory = [];

function addToHistory(content, result) {
    const record = {
        id: detectionHistory.length + 1,
        content: content,
        result: result.label,
        confidence: result.confidence,
        lang: result.lang || currentLang
    };

    detectionHistory.unshift(record);
    if (detectionHistory.length > 100) {
        detectionHistory = detectionHistory.slice(0, 100);
    }
    updateHistoryTable();
}

function updateHistoryTable() {
    if (detectionHistory.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="6" class="no-data">暂无检测记录</td></tr>';
        return;
    }

    historyTableBody.innerHTML = detectionHistory.map((record, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${truncateText(record.content, 50)}</td>
            <td>
                <span class="result-badge ${record.result}">
                    ${record.result === 'spam' ? '🚫 垃圾' : '✅ 正常'}
                </span>
            </td>
            <td>${(record.confidence * 100).toFixed(2)}%</td>
            <td>
                <span class="lang-badge ${record.lang === 'zh' ? 'lang-badge-zh' : 'lang-badge-en'}">
                    ${record.lang === 'zh' ? '🇨🇳 中文' : '🇺🇸 英文'}
                </span>
            </td>
            <td>${new Date().toLocaleTimeString('zh-CN')}</td>
        </tr>
    `).join('');
}

// ========== 辅助函数 ==========
function updateCharCount() {
    const count = smsInput.value.length;
    charCount.textContent = count;
    if (count > 500) {
        smsInput.value = smsInput.value.substring(0, 500);
        charCount.textContent = '500';
    }
}

function showError(message) {
    errorContainer.style.display = 'block';
    resultContainer.style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

window.addEventListener('beforeunload', function () {
    console.log('页面即将卸载');
});