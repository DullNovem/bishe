function loadSavedData() {
    try {
        detectionHistory = JSON.parse(localStorage.getItem(getScopedStorageKey(HISTORY_STORE_KEY)) || '[]');
        if (!Array.isArray(detectionHistory)) {
            detectionHistory = [];
        }
    } catch {
        detectionHistory = [];
    }

    try {
        templates = JSON.parse(localStorage.getItem(getScopedStorageKey(TEMPLATE_STORE_KEY)) || '[]');
        if (!Array.isArray(templates) || !templates.length) {
            templates = [...DEFAULT_TEMPLATES];
        }
    } catch {
        templates = [...DEFAULT_TEMPLATES];
    }

    saveTemplates();
}

function saveHistory() {
    const localRecords = detectionHistory.filter((item) => item.source !== 'backend');
    if (!localRecords.length) {
        localStorage.removeItem(getScopedStorageKey(HISTORY_STORE_KEY));
        return;
    }
    localStorage.setItem(getScopedStorageKey(HISTORY_STORE_KEY), JSON.stringify(localRecords));
}

function saveTemplates() {
    localStorage.setItem(getScopedStorageKey(TEMPLATE_STORE_KEY), JSON.stringify(templates));
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

function showBatchError(message) {
    batchErrorContainer.style.display = 'block';
    batchErrorContainer.textContent = message;
}

function hideBatchError() {
    batchErrorContainer.style.display = 'none';
    batchErrorContainer.textContent = '';
}

function resizeCharts() {
    if (probabilityChart) {
        probabilityChart.resize();
    }
    if (pieChart) {
        pieChart.resize();
    }
    if (trendChart) {
        trendChart.resize();
    }
    if (keywordInsightChart) {
        keywordInsightChart.resize();
    }
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    if (themeToggleBtn) {
        themeToggleBtn.textContent = theme === 'dark' ? '☀' : '🌙';
        themeToggleBtn.title = theme === 'dark' ? '切换亮色模式' : '切换黑夜模式';
    }
}

function isDarkTheme() {
    return document.body.dataset.theme === 'dark';
}

function normalizeKeywordRules(source) {
    return {
        strongWhitelistKeywords: Array.isArray(source.strongWhitelistKeywords) ? source.strongWhitelistKeywords : [],
        strongBlacklistKeywords: Array.isArray(source.strongBlacklistKeywords) ? source.strongBlacklistKeywords : [],
        weakWhitelistKeywords: Array.isArray(source.weakWhitelistKeywords) ? source.weakWhitelistKeywords : [],
        weakBlacklistKeywords: Array.isArray(source.weakBlacklistKeywords) ? source.weakBlacklistKeywords : []
    };
}

function classificationToLabel(classification) {
    if (classification === 1) {
        return 'spam';
    }
    if (classification === 2) {
        return 'suspicious';
    }
    return 'normal';
}

function reverseLabel(label) {
    if (label === 'spam') {
        return 'normal';
    }
    if (label === 'suspicious') {
        return 'normal';
    }
    return 'spam';
}

function formatLabel(label) {
    switch (label) {
        case 'spam':
            return '垃圾短信';
        case 'suspicious':
            return '可疑短信';
        default:
            return '正常短信';
    }
}

function formatDecisionSource(source) {
    switch (source) {
        case 'rule:strong-whitelist':
            return '强白名单直判';
        case 'rule:strong-blacklist':
            return '强黑名单直判';
        case 'fusion:rule-conflict':
            return '模型与规则冲突';
        case 'fusion:low-confidence':
            return '模型低置信度';
        case 'fusion:safe-pattern':
            return '安全通知模式';
        case 'fusion:composite-high-risk':
            return '高风险组合特征';
        case 'fusion:medium-risk':
            return '模型 + 弱规则中风险';
        case 'fusion:high-risk':
            return '模型 + 弱规则高风险';
        case 'fusion:low-risk':
            return '模型 + 弱规则低风险';
        default:
            return source || '-';
    }
}

function formatFeedbackStatus(status) {
    switch (status) {
        case 'accepted':
            return '已采纳';
        case 'ignored':
            return '已忽略';
        default:
            return '待审核';
    }
}

function formatPercentage(value) {
    if (value == null || Number.isNaN(Number(value))) {
        return '-';
    }
    return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatTime(time) {
    const date = new Date(time || Date.now());
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleString('zh-CN');
}

function formatFileSize(size) {
    if (!size) {
        return '0 B';
    }
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function joinKeywords(keywords) {
    return Array.isArray(keywords) && keywords.length ? keywords.join('、') : '无';
}

function getHistorySignature(record) {
    return [
        (record.content || '').trim(),
        record.result || '',
        record.lang || ''
    ].join('::');
}

function statusClass(label) {
    if (label === 'spam') {
        return 'fail';
    }
    if (label === 'suspicious') {
        return 'warning';
    }
    return 'success';
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function inferLangFromContent(content) {
    return /[\u4e00-\u9fa5]/.test(content) ? 'zh' : 'en';
}

function createId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function downloadCsv(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getFeedbackKey(content) {
    return String(content || '');
}

function showToast(message) {
    if (!appToast) {
        return;
    }
    appToast.textContent = message;
    appToast.style.display = 'block';
    if (toastTimer) {
        clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
        appToast.style.display = 'none';
        appToast.textContent = '';
    }, 2400);
}

function downloadBase64File(base64, fileName, mimeType) {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

window.addEventListener('beforeunload', () => {
    if (statsTimer) {
        clearInterval(statsTimer);
    }
    if (batchTaskTimer) {
        clearInterval(batchTaskTimer);
    }
});





