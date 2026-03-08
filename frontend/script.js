const API_BASE_URL = 'http://localhost:8080/api';
const STATS_REFRESH_INTERVAL = 5000;
const HISTORY_STORE_KEY = 'sms_detection_history_v2';
const TEMPLATE_STORE_KEY = 'sms_templates_v1';
const THEME_STORE_KEY = 'sms_theme_mode_v1';

let currentLang = 'en';
let detectionHistory = [];
let templates = [];
let statsTimer = null;
let probabilityChart = null;
let pieChart = null;
let currentHistoryPage = 1;
let historyPageSize = 10;
let lastStats = null;
let lastResult = null;

const smsInput = document.getElementById('smsInput');
const charCount = document.getElementById('charCount');
const detectBtn = document.getElementById('detectBtn');
const resetBtn = document.getElementById('resetBtn');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const historyTableBody = document.getElementById('historyTableBody');

const searchInput = document.getElementById('searchInput');
const resultFilter = document.getElementById('resultFilter');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const exportBtn = document.getElementById('exportBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyPrevBtn = document.getElementById('historyPrevBtn');
const historyNextBtn = document.getElementById('historyNextBtn');
const historyPageInfo = document.getElementById('historyPageInfo');
const historyTotalInfo = document.getElementById('historyTotalInfo');

const templateTableBody = document.getElementById('templateTableBody');
const tplName = document.getElementById('tplName');
const tplLang = document.getElementById('tplLang');
const tplContent = document.getElementById('tplContent');
const addTplBtn = document.getElementById('addTplBtn');

const themeToggleBtn = document.getElementById('themeToggleBtn');
const healthPill = document.getElementById('healthPill');
const pageTitle = document.getElementById('pageTitle');

const PAGE_TITLES = {
    dashboard: '工作台',
    history: '检测记录',
    templates: '样本模板'
};

const DEFAULT_TEMPLATES = [
    {
        id: createId(),
        name: '中奖诱导样本',
        lang: 'zh',
        content: '恭喜您获得现金大奖，请点击链接领取并填写银行卡信息。'
    },
    {
        id: createId(),
        name: 'English phishing sample',
        lang: 'en',
        content: 'Your account is suspended. Verify now at http://fake-link.example to avoid closure.'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeEventListeners();
    initializeNavigation();
    loadSavedData();
    renderTemplateTable();
    renderHistoryTable();
    updateLanguageUI();
    loadStatistics();
    loadRecentRecords();

    statsTimer = setInterval(loadStatistics, STATS_REFRESH_INTERVAL);
    window.addEventListener('resize', resizeCharts);
});

function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_STORE_KEY) || 'light';
    applyTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem(THEME_STORE_KEY, nextTheme);
        if (lastResult) {
            drawProbabilityChart(lastResult.normalProbability, lastResult.spamProbability);
        }
        if (lastStats) {
            drawPieChart(lastStats);
        }
    });
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggleBtn.title = theme === 'dark' ? '切换亮色模式' : '切换黑夜模式';
}

function isDarkTheme() {
    return document.body.dataset.theme === 'dark';
}

function initializeEventListeners() {
    detectBtn.addEventListener('click', handleDetection);
    resetBtn.addEventListener('click', resetDetectionForm);

    smsInput.addEventListener('input', updateCharCount);
    smsInput.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            handleDetection();
        }
    });

    document.getElementById('langSegment').addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('seg-btn')) {
            currentLang = target.dataset.lang;
            updateLanguageUI();
        }
    });

    searchInput.addEventListener('input', () => {
        currentHistoryPage = 1;
        renderHistoryTable();
    });

    resultFilter.addEventListener('change', () => {
        currentHistoryPage = 1;
        renderHistoryTable();
    });

    pageSizeSelect.addEventListener('change', () => {
        historyPageSize = Number(pageSizeSelect.value) || 10;
        currentHistoryPage = 1;
        renderHistoryTable();
    });

    historyPrevBtn.addEventListener('click', () => {
        if (currentHistoryPage > 1) {
            currentHistoryPage -= 1;
            renderHistoryTable();
        }
    });

    historyNextBtn.addEventListener('click', () => {
        const totalPages = getHistoryTotalPages();
        if (currentHistoryPage < totalPages) {
            currentHistoryPage += 1;
            renderHistoryTable();
        }
    });

    exportBtn.addEventListener('click', exportHistoryAsCSV);
    clearHistoryBtn.addEventListener('click', clearLocalHistory);

    addTplBtn.addEventListener('click', addTemplate);
    templateTableBody.addEventListener('click', handleTemplateActions);
}

function initializeNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const pages = document.querySelectorAll('.page');

    menuItems.forEach((item) => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            menuItems.forEach((x) => x.classList.remove('active'));
            item.classList.add('active');

            pages.forEach((p) => p.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');

            pageTitle.textContent = PAGE_TITLES[page] || '管理系统';
            if (page === 'history') {
                renderHistoryTable();
            }
        });
    });
}

function updateLanguageUI() {
    document.querySelectorAll('.seg-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });

    if (currentLang === 'zh') {
        document.getElementById('langTip').textContent = '当前模型：中文';
        smsInput.placeholder = '请输入待检测的中文短信内容...';
    } else {
        document.getElementById('langTip').textContent = '当前模型：英文';
        smsInput.placeholder = 'Enter SMS content...';
    }
}

async function handleDetection() {
    const content = smsInput.value.trim();
    hideError();

    if (!content) {
        showError('请输入短信内容后再检测。');
        return;
    }

    if (content.length > 500) {
        showError('短信内容不能超过 500 字符。');
        return;
    }

    resultContainer.style.display = 'none';
    loadingContainer.style.display = 'block';
    detectBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/detection/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, lang: currentLang })
        });

        const data = await response.json();

        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '检测失败');
        }

        displayResult(data.data);
        addToLocalHistory(content, data.data, true);
        renderHistoryTable();
        loadStatistics();
        healthPill.textContent = '系统状态：在线';
    } catch (error) {
        showError(`检测失败：${error.message}`);
        healthPill.textContent = '系统状态：后端不可达';
    } finally {
        loadingContainer.style.display = 'none';
        detectBtn.disabled = false;
    }
}

function displayResult(result) {
    const isSpam = result.label === 'spam';
    lastResult = result;

    resultContainer.style.display = 'block';
    const resultLabel = document.getElementById('resultLabel');
    resultLabel.className = `result-banner ${result.label}`;
    resultLabel.textContent = isSpam ? '垃圾短信' : '正常短信';

    document.getElementById('resultText').textContent = isSpam ? '垃圾短信' : '正常短信';
    document.getElementById('resultConfidence').textContent = `${(result.confidence * 100).toFixed(2)}%`;
    document.getElementById('resultNormalProb').textContent = `${(result.normalProbability * 100).toFixed(2)}%`;
    document.getElementById('resultSpamProb').textContent = `${(result.spamProbability * 100).toFixed(2)}%`;
    document.getElementById('resultLangBadge').textContent = (result.lang || currentLang) === 'zh' ? '中文模型' : '英文模型';

    drawProbabilityChart(result.normalProbability, result.spamProbability);
}

function drawProbabilityChart(normalProb, spamProb) {
    if (!window.echarts) return;

    const chartEl = document.getElementById('probabilityChart');
    probabilityChart = probabilityChart || echarts.init(chartEl);

    const axisColor = isDarkTheme() ? '#6d7481' : '#9aa4b2';
    const splitColor = isDarkTheme() ? '#2f3542' : '#edf0f5';
    const titleColor = isDarkTheme() ? '#e8ecf2' : '#1d2129';

    probabilityChart.setOption({
        backgroundColor: 'transparent',
        title: {
            text: '分类概率分布',
            left: 'center',
            textStyle: { color: titleColor, fontSize: 14 }
        },
        tooltip: { trigger: 'axis' },
        xAxis: {
            type: 'category',
            data: ['正常短信', '垃圾短信'],
            axisLine: { lineStyle: { color: axisColor } }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLine: { lineStyle: { color: axisColor } },
            splitLine: { lineStyle: { color: splitColor } }
        },
        series: [{
            type: 'bar',
            barMaxWidth: 46,
            data: [
                Number((normalProb * 100).toFixed(2)),
                Number((spamProb * 100).toFixed(2))
            ],
            itemStyle: {
                color: (params) => (params.dataIndex === 0 ? '#39eb6e' : '#d82e3a')
            }
        }]
    });
}

async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/statistics`);
        const data = await response.json();

        if (response.ok && data.code === 200) {
            lastStats = data.data;
            updateStatisticsDisplay(data.data);
            drawPieChart(data.data);
            healthPill.textContent = '系统状态：在线';
        }
    } catch (error) {
        healthPill.textContent = '系统状态：后端不可达';
    }
}

function updateStatisticsDisplay(stats) {
    document.getElementById('totalDetections').textContent = stats.totalDetections || 0;
    document.getElementById('spamCount').textContent = stats.spamCount || 0;
    document.getElementById('normalCount').textContent = stats.normalCount || 0;
}

function drawPieChart(stats) {
    if (!window.echarts) return;

    const chartEl = document.getElementById('pieChart');
    pieChart = pieChart || echarts.init(chartEl);

    const titleColor = isDarkTheme() ? '#e8ecf2' : '#1d2129';
    const legendColor = isDarkTheme() ? '#b8c0cc' : '#5f6b7a';

    pieChart.setOption({
        backgroundColor: 'transparent',
        title: {
            text: '垃圾/正常占比',
            left: 12,
            top: 8,
            textStyle: { color: titleColor, fontSize: 14, fontWeight: 600 }
        },
        tooltip: { trigger: 'item' },
        legend: {
            top: 8,
            right: 10,
            orient: 'horizontal',
            itemWidth: 14,
            itemHeight: 8,
            textStyle: { color: legendColor }
        },
        series: [{
            type: 'pie',
            radius: ['0%', '62%'],
            center: ['50%', '62%'],
            label: { color: legendColor },
            labelLine: { lineStyle: { color: legendColor } },
            data: [
                { value: stats.normalCount || 0, name: '正常短信', itemStyle: { color: '#39eb6e' } },
                { value: stats.spamCount || 0, name: '垃圾短信', itemStyle: { color: '#d82e3a' } }
            ]
        }]
    });
}

async function loadRecentRecords() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/recent-records?limit=100`);
        const data = await response.json();

        if (response.ok && data.code === 200 && Array.isArray(data.data) && data.data.length > 0) {
            const mapped = data.data.map((item) => ({
                id: createId(),
                content: item.smsContent || '',
                result: item.label || (item.classification === 1 ? 'spam' : 'normal'),
                confidence: Number(item.confidence || 0),
                lang: inferLangFromContent(item.smsContent || ''),
                source: 'backend',
                time: item.detectionTime || new Date().toISOString()
            }));

            const merged = [...mapped, ...detectionHistory.filter((x) => x.source !== 'backend')];
            detectionHistory = merged.slice(0, 300);
            saveHistory();
            renderHistoryTable();
        }
    } catch (error) {
    }
}

function addToLocalHistory(content, result, fromDetect = false) {
    const record = {
        id: createId(),
        content,
        result: result.label,
        confidence: Number(result.confidence || 0),
        lang: result.lang || currentLang,
        source: fromDetect ? 'local' : 'backend',
        time: new Date().toISOString()
    };

    detectionHistory.unshift(record);
    detectionHistory = detectionHistory.slice(0, 300);
    saveHistory();
}

function getFilteredHistory() {
    const keyword = (searchInput.value || '').trim().toLowerCase();
    const filter = resultFilter.value;

    return detectionHistory.filter((record) => {
        const byKeyword = !keyword || record.content.toLowerCase().includes(keyword);
        const byResult = filter === 'all' || record.result === filter;
        return byKeyword && byResult;
    });
}

function getHistoryTotalPages() {
    const total = getFilteredHistory().length;
    return Math.max(1, Math.ceil(total / historyPageSize));
}

function renderHistoryTable() {
    const filtered = getFilteredHistory();
    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / historyPageSize));

    if (currentHistoryPage > totalPages) {
        currentHistoryPage = totalPages;
    }

    const start = (currentHistoryPage - 1) * historyPageSize;
    const end = start + historyPageSize;
    const pageRows = filtered.slice(start, end);

    historyTotalInfo.textContent = `共 ${totalRecords} 条`;
    historyPageInfo.textContent = `第 ${currentHistoryPage} / ${totalPages} 页`;
    historyPrevBtn.disabled = currentHistoryPage <= 1;
    historyNextBtn.disabled = currentHistoryPage >= totalPages;

    if (pageRows.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="6" class="muted center">暂无记录</td></tr>';
        return;
    }

    historyTableBody.innerHTML = pageRows.map((record, index) => `
        <tr>
            <td>${start + index + 1}</td>
            <td>${escapeHtml(truncateText(record.content, 60))}</td>
            <td><span class="badge ${record.result}">${record.result === 'spam' ? '垃圾' : '正常'}</span></td>
            <td>${(record.confidence * 100).toFixed(2)}%</td>
            <td>${record.lang === 'zh' ? '中文' : '英文'}</td>
            <td>${formatTime(record.time)}</td>
        </tr>
    `).join('');
}

function addTemplate() {
    const name = tplName.value.trim();
    const lang = tplLang.value;
    const content = tplContent.value.trim();

    if (!name || !content) {
        showError('模板名称和模板内容不能为空。');
        return;
    }

    templates.unshift({ id: createId(), name, lang, content });
    templates = templates.slice(0, 50);
    saveTemplates();
    renderTemplateTable();

    tplName.value = '';
    tplContent.value = '';
    hideError();
}

function handleTemplateActions(event) {
    const target = event.target;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;

    const template = templates.find((item) => item.id === id);
    if (!template) return;

    if (action === 'use') {
        currentLang = template.lang;
        updateLanguageUI();
        smsInput.value = template.content;
        updateCharCount();
        document.querySelector('[data-page="dashboard"]').click();
    }

    if (action === 'delete') {
        templates = templates.filter((item) => item.id !== id);
        saveTemplates();
        renderTemplateTable();
    }
}

function renderTemplateTable() {
    if (templates.length === 0) {
        templateTableBody.innerHTML = '<tr><td colspan="4" class="muted center">暂无模板</td></tr>';
        return;
    }

    templateTableBody.innerHTML = templates.map((item) => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.lang === 'zh' ? '中文' : '英文'}</td>
            <td>${escapeHtml(truncateText(item.content, 72))}</td>
            <td>
                <button class="btn" data-action="use" data-id="${item.id}">填充</button>
                <button class="btn" data-action="delete" data-id="${item.id}">删除</button>
            </td>
        </tr>
    `).join('');
}

function exportHistoryAsCSV() {
    const rows = getFilteredHistory().map((record) => ([
        record.content,
        record.result,
        `${(record.confidence * 100).toFixed(2)}%`,
        record.lang,
        formatTime(record.time)
    ]));

    if (rows.length === 0) {
        showError('没有可导出的记录。');
        return;
    }

    const csv = ['内容,结果,置信度,模型,时间', ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detection-history-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function clearLocalHistory() {
    detectionHistory = detectionHistory.filter((item) => item.source === 'backend');
    currentHistoryPage = 1;
    saveHistory();
    renderHistoryTable();
}

function resetDetectionForm() {
    smsInput.value = '';
    charCount.textContent = '0';
    resultContainer.style.display = 'none';
    hideError();
}

function updateCharCount() {
    if (smsInput.value.length > 500) {
        smsInput.value = smsInput.value.slice(0, 500);
    }
    charCount.textContent = String(smsInput.value.length);
}

function showError(message) {
    errorContainer.style.display = 'block';
    errorContainer.textContent = message;
}

function hideError() {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
}

function resizeCharts() {
    if (probabilityChart) probabilityChart.resize();
    if (pieChart) pieChart.resize();
}

function loadSavedData() {
    try {
        const localHistory = JSON.parse(localStorage.getItem(HISTORY_STORE_KEY) || '[]');
        detectionHistory = Array.isArray(localHistory) ? localHistory : [];
    } catch {
        detectionHistory = [];
    }

    try {
        const localTemplates = JSON.parse(localStorage.getItem(TEMPLATE_STORE_KEY) || '[]');
        templates = Array.isArray(localTemplates) && localTemplates.length > 0 ? localTemplates : DEFAULT_TEMPLATES;
    } catch {
        templates = DEFAULT_TEMPLATES;
    }

    saveTemplates();
}

function saveHistory() {
    localStorage.setItem(HISTORY_STORE_KEY, JSON.stringify(detectionHistory));
}

function saveTemplates() {
    localStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(templates));
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function inferLangFromContent(content) {
    return /[\u4e00-\u9fa5]/.test(content) ? 'zh' : 'en';
}

function formatTime(time) {
    const date = new Date(time || Date.now());
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN');
}

function createId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function csvEscape(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

window.addEventListener('beforeunload', () => {
    if (statsTimer) clearInterval(statsTimer);
});


