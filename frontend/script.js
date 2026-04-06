const API_BASE_URL = 'http://localhost:8080/api';
const STATS_REFRESH_INTERVAL = 5000;
const HISTORY_STORE_KEY = 'sms_detection_history_v3';
const TEMPLATE_STORE_KEY = 'sms_templates_v1';
const THEME_STORE_KEY = 'sms_theme_mode_v1';
const CURRENT_USER_STORE_KEY = 'sms_current_user_v1';

let currentLang = 'en';
let currentBatchLang = 'en';
let detectionHistory = [];
let templates = [];
let keywordRules = {
    strongWhitelistKeywords: [],
    strongBlacklistKeywords: [],
    weakWhitelistKeywords: [],
    weakBlacklistKeywords: []
};
let feedbackSamples = [];
let lastStats = null;
let lastResult = null;
let lastBatchResult = null;
let currentBatchFile = null;
let statsTimer = null;
let probabilityChart = null;
let pieChart = null;
let currentHistoryPage = 1;
let historyPageSize = 10;
let pendingFeedbackPayload = null;
let toastTimer = null;
let submittedFeedbackKeys = new Set();
let keywordStats = [];
let currentUser = null;

const authShell = document.getElementById('authShell');
const appShell = document.getElementById('appShell');
const authError = document.getElementById('authError');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserChip = document.getElementById('currentUserChip');
const registerUsername = document.getElementById('registerUsername');
const registerDisplayName = document.getElementById('registerDisplayName');
const registerPhone = document.getElementById('registerPhone');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerUsernameMessage = document.getElementById('registerUsernameMessage');
const registerDisplayNameMessage = document.getElementById('registerDisplayNameMessage');
const registerPhoneMessage = document.getElementById('registerPhoneMessage');
const registerEmailMessage = document.getElementById('registerEmailMessage');
const registerPasswordMessage = document.getElementById('registerPasswordMessage');

const smsInput = document.getElementById('smsInput');
const charCount = document.getElementById('charCount');
const detectBtn = document.getElementById('detectBtn');
const resetBtn = document.getElementById('resetBtn');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');

const totalDetections = document.getElementById('totalDetections');
const spamCount = document.getElementById('spamCount');
const suspiciousCount = document.getElementById('suspiciousCount');
const normalCount = document.getElementById('normalCount');

const batchFileInput = document.getElementById('batchFileInput');
const triggerUploadBtn = document.getElementById('triggerUploadBtn');
const batchDetectBtn = document.getElementById('batchDetectBtn');
const batchLoadingContainer = document.getElementById('batchLoadingContainer');
const batchErrorContainer = document.getElementById('batchErrorContainer');
const batchResultContainer = document.getElementById('batchResultContainer');
const batchTableBody = document.getElementById('batchTableBody');
const downloadBatchReportBtn = document.getElementById('downloadBatchReportBtn');
const selectedFileName = document.getElementById('selectedFileName');
const batchLangTip = document.getElementById('batchLangTip');

const batchTotalCount = document.getElementById('batchTotalCount');
const batchSuccessCount = document.getElementById('batchSuccessCount');
const batchFailedCount = document.getElementById('batchFailedCount');
const batchSpamCount = document.getElementById('batchSpamCount');
const batchSuspiciousCount = document.getElementById('batchSuspiciousCount');
const batchNormalCount = document.getElementById('batchNormalCount');

const searchInput = document.getElementById('searchInput');
const resultFilter = document.getElementById('resultFilter');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const exportBtn = document.getElementById('exportBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyPrevBtn = document.getElementById('historyPrevBtn');
const historyNextBtn = document.getElementById('historyNextBtn');
const historyPageInfo = document.getElementById('historyPageInfo');
const historyTotalInfo = document.getElementById('historyTotalInfo');
const historyTableBody = document.getElementById('historyTableBody');

const templateTableBody = document.getElementById('templateTableBody');
const tplName = document.getElementById('tplName');
const tplLang = document.getElementById('tplLang');
const tplContent = document.getElementById('tplContent');
const addTplBtn = document.getElementById('addTplBtn');

const pageTitle = document.getElementById('pageTitle');
const healthPill = document.getElementById('healthPill');
const themeToggleBtn = document.getElementById('themeToggleBtn');

const saveRulesBtn = document.getElementById('saveRulesBtn');
const strongWhitelistInput = document.getElementById('strongWhitelistInput');
const strongBlacklistInput = document.getElementById('strongBlacklistInput');
const weakWhitelistInput = document.getElementById('weakWhitelistInput');
const weakBlacklistInput = document.getElementById('weakBlacklistInput');
const addStrongWhitelistBtn = document.getElementById('addStrongWhitelistBtn');
const addStrongBlacklistBtn = document.getElementById('addStrongBlacklistBtn');
const addWeakWhitelistBtn = document.getElementById('addWeakWhitelistBtn');
const addWeakBlacklistBtn = document.getElementById('addWeakBlacklistBtn');
const strongWhitelistList = document.getElementById('strongWhitelistList');
const strongBlacklistList = document.getElementById('strongBlacklistList');
const weakWhitelistList = document.getElementById('weakWhitelistList');
const weakBlacklistList = document.getElementById('weakBlacklistList');

const feedbackTableBody = document.getElementById('feedbackTableBody');
const refreshFeedbackBtn = document.getElementById('refreshFeedbackBtn');
const exportAcceptedBtn = document.getElementById('exportAcceptedBtn');
const generateTrainingDatasetBtn = document.getElementById('generateTrainingDatasetBtn');
const keywordStatsTableBody = document.getElementById('keywordStatsTableBody');
const feedbackModal = document.getElementById('feedbackModal');
const feedbackPreviewText = document.getElementById('feedbackPreviewText');
const closeFeedbackModalBtn = document.getElementById('closeFeedbackModalBtn');
const appToast = document.getElementById('appToast');

const PAGE_TITLES = {
    dashboard: '检测工作台',
    batch: '批量检测',
    rules: '规则管理',
    feedback: '待审核样本',
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
        name: '官方验证码样本',
        lang: 'zh',
        content: '【银行】您的验证码为 123456，5 分钟内有效。'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeAuth();
    initializeNavigation();
    initializeEventListeners();
    loadSavedData();
    renderTemplateTable();
    renderHistoryTable();
    renderKeywordLists();
    renderFeedbackTable();
    renderBatchTable([]);
    updateLanguageUI();
    updateBatchLanguageUI();
    loadStatistics();
    loadRecentRecords();
    loadKeywordRules();
    loadFeedbackSamples();
    loadKeywordStats();
    restoreCurrentUser();

    statsTimer = setInterval(loadStatistics, STATS_REFRESH_INTERVAL);
    window.addEventListener('resize', resizeCharts);
});

function initializeAuth() {
    switchAuthTab('login');
    hideAuthError();
    bindRegisterValidation();
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.authTab === tab);
    });
    loginForm.classList.toggle('active', tab === 'login');
    registerForm.classList.toggle('active', tab === 'register');
    hideAuthError();
}

function restoreCurrentUser() {
    try {
        currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_STORE_KEY) || 'null');
    } catch {
        currentUser = null;
    }
    updateAuthUI();
}

function updateAuthUI() {
    const loggedIn = !!(currentUser && currentUser.id);
    authShell.classList.toggle('hidden', loggedIn);
    appShell.classList.toggle('hidden', !loggedIn);
    currentUserChip.textContent = loggedIn
        ? `${currentUser.displayName || currentUser.username} / ${currentUser.username}`
        : '未登录';
}

function persistCurrentUser(user) {
    currentUser = user;
    localStorage.setItem(CURRENT_USER_STORE_KEY, JSON.stringify(user));
    updateAuthUI();
}

function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem(CURRENT_USER_STORE_KEY);
    updateAuthUI();
}

async function handleLogin(event) {
    event.preventDefault();
    hideAuthError();

    const payload = {
        username: document.getElementById('loginUsername').value.trim(),
        password: document.getElementById('loginPassword').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '登录失败');
        }
        persistCurrentUser(data.data);
        loginForm.reset();
        showToast('登录成功');
    } catch (error) {
        showAuthError(error.message || '登录失败');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    hideAuthError();
    const validation = validateRegisterForm(true);
    if (!validation.valid) {
        showAuthError('请先按提示完善注册信息');
        return;
    }

    const payload = {
        username: registerUsername.value.trim(),
        displayName: registerDisplayName.value.trim(),
        phone: registerPhone.value.trim(),
        email: registerEmail.value.trim(),
        password: registerPassword.value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '注册失败');
        }
        persistCurrentUser(data.data);
        registerForm.reset();
        showToast('注册成功，已自动登录');
    } catch (error) {
        showAuthError(error.message || '注册失败');
    }
}

function handleLogout() {
    clearCurrentUser();
    switchAuthTab('login');
    showToast('已退出登录');
}

function showAuthError(message) {
    authError.style.display = 'block';
    authError.textContent = message;
}

function hideAuthError() {
    authError.style.display = 'none';
    authError.textContent = '';
}

function bindRegisterValidation() {
    [
        [registerUsername, registerUsernameMessage, validateUsername],
        [registerDisplayName, registerDisplayNameMessage, validateDisplayName],
        [registerPhone, registerPhoneMessage, validatePhone],
        [registerEmail, registerEmailMessage, validateEmail],
        [registerPassword, registerPasswordMessage, validatePassword]
    ].forEach(([input, messageEl, validator]) => {
        input.addEventListener('input', () => {
            applyFieldValidation(input, messageEl, validator(input.value), false);
        });
        input.addEventListener('blur', () => {
            applyFieldValidation(input, messageEl, validator(input.value), true);
        });
    });
}

function validateRegisterForm(forceShow) {
    const usernameState = applyFieldValidation(registerUsername, registerUsernameMessage, validateUsername(registerUsername.value), forceShow);
    const displayNameState = applyFieldValidation(registerDisplayName, registerDisplayNameMessage, validateDisplayName(registerDisplayName.value), forceShow);
    const phoneState = applyFieldValidation(registerPhone, registerPhoneMessage, validatePhone(registerPhone.value), forceShow);
    const emailState = applyFieldValidation(registerEmail, registerEmailMessage, validateEmail(registerEmail.value), forceShow);
    const passwordState = applyFieldValidation(registerPassword, registerPasswordMessage, validatePassword(registerPassword.value), forceShow);
    return {
        valid: usernameState && displayNameState && phoneState && emailState && passwordState
    };
}

function applyFieldValidation(input, messageEl, state, forceShow) {
    const hasValue = String(input.value || '').trim().length > 0;
    const shouldShow = forceShow || hasValue;
    input.classList.toggle('invalid', shouldShow && !state.valid);
    messageEl.classList.remove('error', 'success');

    if (!shouldShow) {
        messageEl.textContent = '';
        return state.valid;
    }

    messageEl.textContent = state.message;
    if (state.valid) {
        messageEl.classList.add('success');
    } else {
        messageEl.classList.add('error');
    }
    return state.valid;
}

function validateUsername(value) {
    const text = String(value || '').trim();
    if (!text) {
        return { valid: false, message: '请输入用户名' };
    }
    if (text.length < 4 || text.length > 32) {
        return { valid: false, message: '用户名长度需在 4 到 32 位之间' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(text)) {
        return { valid: false, message: '用户名仅支持字母、数字和下划线' };
    }
    return { valid: true, message: '用户名格式可用' };
}

function validateDisplayName(value) {
    const text = String(value || '').trim();
    if (!text) {
        return { valid: false, message: '请输入显示名称' };
    }
    if (text.length < 2 || text.length > 32) {
        return { valid: false, message: '显示名称长度需在 2 到 32 位之间' };
    }
    return { valid: true, message: '显示名称可用' };
}

function validatePhone(value) {
    const text = String(value || '').trim();
    if (!text) {
        return { valid: false, message: '请输入手机号' };
    }
    if (!/^1\d{10}$/.test(text)) {
        return { valid: false, message: '请输入有效的 11 位手机号' };
    }
    return { valid: true, message: '手机号格式正确' };
}

function validateEmail(value) {
    const text = String(value || '').trim();
    if (!text) {
        return { valid: false, message: '请输入邮箱' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        return { valid: false, message: '请输入有效的邮箱地址' };
    }
    return { valid: true, message: '邮箱格式正确' };
}

function validatePassword(value) {
    const text = String(value || '');
    if (!text) {
        return { valid: false, message: '请输入密码' };
    }
    if (text.length < 6 || text.length > 32) {
        return { valid: false, message: '密码长度需在 6 到 32 位之间' };
    }
    if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) {
        return { valid: false, message: '密码需同时包含字母和数字' };
    }
    return { valid: true, message: '密码强度可用' };
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_STORE_KEY) || 'light';
    applyTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem(THEME_STORE_KEY, nextTheme);
        if (lastResult) {
            drawProbabilityChart(lastResult);
        }
        if (lastStats) {
            drawPieChart(lastStats);
        }
    });
}

function initializeNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const pages = document.querySelectorAll('.page');

    menuItems.forEach((item) => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            menuItems.forEach((element) => element.classList.remove('active'));
            item.classList.add('active');
            pages.forEach((pageElement) => pageElement.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');
            pageTitle.textContent = PAGE_TITLES[page] || '管理系统';

            if (page === 'history') {
                renderHistoryTable();
            }
            if (page === 'feedback') {
                renderFeedbackTable();
                renderKeywordStatsTable();
            }
            if (page === 'batch' && lastBatchResult) {
                renderBatchTable(lastBatchResult.items || []);
            }
        });
    });
}

function initializeEventListeners() {
    document.querySelectorAll('.auth-tab').forEach((button) => {
        button.addEventListener('click', () => switchAuthTab(button.dataset.authTab));
    });
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutBtn.addEventListener('click', handleLogout);

    detectBtn.addEventListener('click', handleDetection);
    resetBtn.addEventListener('click', resetDetectionForm);
    submitFeedbackBtn.addEventListener('click', submitSingleFeedback);

    smsInput.addEventListener('input', updateCharCount);
    smsInput.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            handleDetection();
        }
    });

    document.getElementById('langSegment').addEventListener('click', handleLanguageSwitch);
    document.getElementById('batchLangSegment').addEventListener('click', handleBatchLanguageSwitch);

    triggerUploadBtn.addEventListener('click', () => batchFileInput.click());
    batchFileInput.addEventListener('change', handleBatchFileChange);
    batchDetectBtn.addEventListener('click', handleBatchDetection);
    downloadBatchReportBtn.addEventListener('click', downloadBatchReport);
    batchTableBody.addEventListener('click', handleBatchTableActions);

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

    addStrongWhitelistBtn.addEventListener('click', () => addKeyword('strongWhitelistKeywords', strongWhitelistInput));
    addStrongBlacklistBtn.addEventListener('click', () => addKeyword('strongBlacklistKeywords', strongBlacklistInput));
    addWeakWhitelistBtn.addEventListener('click', () => addKeyword('weakWhitelistKeywords', weakWhitelistInput));
    addWeakBlacklistBtn.addEventListener('click', () => addKeyword('weakBlacklistKeywords', weakBlacklistInput));
    saveRulesBtn.addEventListener('click', saveKeywordRules);
    strongWhitelistList.addEventListener('click', handleKeywordActions);
    strongBlacklistList.addEventListener('click', handleKeywordActions);
    weakWhitelistList.addEventListener('click', handleKeywordActions);
    weakBlacklistList.addEventListener('click', handleKeywordActions);

    refreshFeedbackBtn.addEventListener('click', loadFeedbackSamples);
    exportAcceptedBtn.addEventListener('click', exportAcceptedSamples);
    generateTrainingDatasetBtn.addEventListener('click', generateTrainingDataset);
    feedbackTableBody.addEventListener('click', handleFeedbackTableActions);
    closeFeedbackModalBtn.addEventListener('click', closeFeedbackModal);
    feedbackModal.addEventListener('click', handleFeedbackModalActions);
}

function handleLanguageSwitch(event) {
    if (!event.target.classList.contains('seg-btn')) {
        return;
    }
    currentLang = event.target.dataset.lang;
    updateLanguageUI();
}

function handleBatchLanguageSwitch(event) {
    if (!event.target.classList.contains('seg-btn')) {
        return;
    }
    currentBatchLang = event.target.dataset.lang;
    updateBatchLanguageUI();
}

function updateLanguageUI() {
    document.querySelectorAll('#langSegment .seg-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.lang === currentLang);
    });
    document.getElementById('langTip').textContent = currentLang === 'zh' ? '当前模型：中文' : '当前模型：英文';
    smsInput.placeholder = currentLang === 'zh' ? '请输入待检测的中文短信内容...' : 'Enter SMS content...';
}

function updateBatchLanguageUI() {
    document.querySelectorAll('#batchLangSegment .seg-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.lang === currentBatchLang);
    });
    batchLangTip.textContent = currentBatchLang === 'zh' ? '当前模型：中文' : '当前模型：英文';
}

async function handleDetection() {
    const content = smsInput.value.trim();
    hideError();

    if (!content) {
        showError('请输入短信内容后再检测。');
        return;
    }
    if (content.length > 500) {
        showError('短信内容不能超过 500 个字符。');
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

        lastResult = data.data;
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
    resultContainer.style.display = 'block';
    const banner = document.getElementById('resultLabel');
    banner.className = `result-banner ${result.label}`;
    banner.textContent = formatLabel(result.label);

    document.getElementById('resultText').textContent = formatLabel(result.label);
    document.getElementById('resultConfidence').textContent = formatPercentage(result.confidence);
    document.getElementById('resultNormalProb').textContent = formatPercentage(result.normalProbability);
    document.getElementById('resultSpamProb').textContent = formatPercentage(result.spamProbability);
    document.getElementById('resultLangBadge').textContent = result.lang === 'zh' ? '中文模型' : '英文模型';

    drawProbabilityChart(result);
}

async function handleBatchDetection() {
    hideBatchError();
    if (!currentBatchFile) {
        showBatchError('请先选择 .csv 或 .txt 文件。');
        return;
    }

    const formData = new FormData();
    formData.append('file', currentBatchFile);
    formData.append('lang', currentBatchLang);

    batchLoadingContainer.style.display = 'block';
    batchResultContainer.style.display = 'none';
    batchDetectBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/detection/batch-detect`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '批量检测失败');
        }

        lastBatchResult = data.data;
        displayBatchResult(data.data);
        mergeBatchResultsToHistory(data.data.items || []);
        renderHistoryTable();
        loadStatistics();
        healthPill.textContent = '系统状态：在线';
    } catch (error) {
        showBatchError(`批量检测失败：${error.message}`);
        healthPill.textContent = '系统状态：后端不可达';
    } finally {
        batchLoadingContainer.style.display = 'none';
        batchDetectBtn.disabled = false;
    }
}

function handleBatchFileChange(event) {
    const [file] = event.target.files || [];
    currentBatchFile = file || null;
    selectedFileName.textContent = currentBatchFile ? `${currentBatchFile.name} (${formatFileSize(currentBatchFile.size)})` : '未选择文件';
}

function displayBatchResult(result) {
    batchResultContainer.style.display = 'block';
    batchTotalCount.textContent = result.totalCount || 0;
    batchSuccessCount.textContent = result.successCount || 0;
    batchFailedCount.textContent = result.failedCount || 0;
    batchSpamCount.textContent = result.spamCount || 0;
    batchSuspiciousCount.textContent = result.suspiciousCount || 0;
    batchNormalCount.textContent = result.normalCount || 0;
    renderBatchTable(result.items || []);
}

function renderBatchTable(items) {
    if (!items.length) {
        batchTableBody.innerHTML = '<tr><td colspan="7" class="muted center">暂无批量检测结果</td></tr>';
        return;
    }

    batchTableBody.innerHTML = items.slice(0, 100).map((item) => `
        <tr>
            <td>${item.rowNo || '-'}</td>
            <td>${escapeHtml(truncateText(item.content || '', 70))}</td>
            <td><span class="badge ${item.label}">${formatLabel(item.label)}</span></td>
            <td>${formatPercentage(item.confidence)}</td>
            <td></td>
            <td>${item.error ? `<span class="batch-status fail">${escapeHtml(item.error)}</span>` : `<span class="batch-status ${statusClass(item.label)}">${escapeHtml(formatDecisionSource(item.decisionSource))}</span>`}</td>
            <td>${renderBatchFeedbackButton(item)}</td>
        </tr>
    `).join('');
}

function renderBatchFeedbackButton(item) {
    if (item.error) {
        return '-';
    }
    const feedbackKey = getFeedbackKey(item.content, item.rowNo);
    if (submittedFeedbackKeys.has(feedbackKey)) {
        return '<span class="muted">已提交</span>';
    }
    return `<button class="btn btn-xs" data-action="feedback-batch" data-row="${item.rowNo}">纠错</button>`;
}

function handleBatchTableActions(event) {
    const button = event.target.closest('button[data-action="feedback-batch"]');
    if (!button || !lastBatchResult || !Array.isArray(lastBatchResult.items)) {
        return;
    }

    const rowNo = Number(button.dataset.row);
    const item = lastBatchResult.items.find((entry) => Number(entry.rowNo) === rowNo);
    if (!item) {
        return;
    }

    openFeedbackModal({
        content: item.content,
        predictedLabel: item.label,
        lang: item.lang || currentBatchLang,
        sourceType: 'batch',
        rowNo: item.rowNo,
        decisionSource: item.decisionSource,
        ruleNote: item.ruleNote
    });
}

function downloadBatchReport() {
    if (!lastBatchResult || !lastBatchResult.reportBase64) {
        showBatchError('当前没有可下载的批量检测报告。');
        return;
    }

    const bytes = Uint8Array.from(atob(lastBatchResult.reportBase64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = lastBatchResult.reportFileName || `batch-detection-report-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/statistics`);
        const data = await response.json();
        if (response.ok && data.code === 200) {
            lastStats = data.data;
            totalDetections.textContent = data.data.totalDetections || 0;
            spamCount.textContent = data.data.spamCount || 0;
            suspiciousCount.textContent = data.data.suspiciousCount || 0;
            normalCount.textContent = data.data.normalCount || 0;
            drawPieChart(data.data);
            healthPill.textContent = '系统状态：在线';
        }
    } catch {
        healthPill.textContent = '系统状态：在线';
    }
}

function drawProbabilityChart(result) {
    if (!window.echarts) {
        return;
    }

    const chartEl = document.getElementById('probabilityChart');
    probabilityChart = probabilityChart || echarts.init(chartEl);
    const axisColor = isDarkTheme() ? '#6d7481' : '#9aa4b2';
    const splitColor = isDarkTheme() ? '#2f3542' : '#edf0f5';
    const titleColor = isDarkTheme() ? '#e8ecf2' : '#1d2129';

    probabilityChart.setOption({
        backgroundColor: 'transparent',
        title: {
            text: '风险判定分布',
            left: 'center',
            textStyle: { color: titleColor, fontSize: 14 }
        },
        tooltip: { trigger: 'axis' },
        xAxis: {
            type: 'category',
            data: ['正常概率', '可疑概率', '垃圾概率'],
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
                Number(((result.normalProbability || 0) * 100).toFixed(2)),
                Number(((result.suspiciousProbability || 0) * 100).toFixed(2)),
                Number(((result.spamProbability || 0) * 100).toFixed(2))
            ],
            itemStyle: {
                color: ({ dataIndex }) => ['#8ddfa6', '#f5c86a', '#ffb3b8'][dataIndex]
            }
        }]
    });
}

function drawPieChart(stats) {
    const chartEl = document.getElementById('pieChart');
    if (!chartEl) {
        return;
    }

    const normal = Number(stats.normalCount || 0);
    const suspicious = Number(stats.suspiciousCount || 0);
    const spam = Number(stats.spamCount || 0);
    const total = normal + suspicious + spam;

    if (pieChart) {
        try {
            pieChart.dispose();
        } catch {}
        pieChart = null;
    }
    renderPieFallback(chartEl, { normal, suspicious, spam, total });
}

function renderPieFallback(container, stats) {
    const total = stats.total || 0;
    const radius = 78;
    const circumference = 2 * Math.PI * radius;
    const safeTotal = total || 1;
    const normalLength = (stats.normal / safeTotal) * circumference;
    const suspiciousLength = (stats.suspicious / safeTotal) * circumference;
    const spamLength = Math.max(circumference - normalLength - suspiciousLength, 0);

    container.innerHTML = `
        <div class="pie-fallback">
            <div class="pie-fallback-ring">
                <svg viewBox="0 0 200 200" aria-hidden="true">
                    <circle class="pie-fallback-track" cx="100" cy="100" r="${radius}"></circle>
                    <circle class="pie-fallback-segment" cx="100" cy="100" r="${radius}" stroke="#8ddfa6"
                        stroke-dasharray="${normalLength} ${Math.max(circumference - normalLength, 0)}"
                        stroke-dashoffset="0"></circle>
                    <circle class="pie-fallback-segment" cx="100" cy="100" r="${radius}" stroke="#f5c86a"
                        stroke-dasharray="${suspiciousLength} ${Math.max(circumference - suspiciousLength, 0)}"
                        stroke-dashoffset="${-normalLength}"></circle>
                    <circle class="pie-fallback-segment" cx="100" cy="100" r="${radius}" stroke="#ffb3b8"
                        stroke-dasharray="${spamLength} ${Math.max(circumference - spamLength, 0)}"
                        stroke-dashoffset="${-(normalLength + suspiciousLength)}"></circle>
                </svg>
                <div class="pie-fallback-center">
                    <strong>${total}</strong>
                    <span>总数</span>
                </div>
            </div>
            <div class="pie-fallback-legend">
                ${renderPieFallbackItem('正常短信', stats.normal, '#8ddfa6')}
                ${renderPieFallbackItem('可疑短信', stats.suspicious, '#f5c86a')}
                ${renderPieFallbackItem('垃圾短信', stats.spam, '#ffb3b8')}
            </div>
        </div>
    `;
}

function renderPieFallbackItem(label, value, color) {
    return `
        <div class="pie-fallback-item">
            <span class="pie-fallback-label">
                <i class="pie-fallback-dot" style="background:${color};"></i>
                ${label}
            </span>
            <strong>${value}</strong>
        </div>
    `;
}

async function loadRecentRecords() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/recent-records?limit=100`);
        const data = await response.json();
        if (response.ok && data.code === 200 && Array.isArray(data.data) && data.data.length > 0) {
            const localRecords = detectionHistory.filter((item) => item.source !== 'backend');
            const localSignatures = new Set(localRecords.map(getHistorySignature));
            const mapped = data.data.map((item) => ({
                id: createId(),
                content: item.smsContent || '',
                result: item.label || classificationToLabel(item.classification),
                confidence: Number(item.confidence || 0),
                lang: item.lang || inferLangFromContent(item.smsContent || ''),
                source: 'backend',
                time: item.detectionTime || new Date().toISOString()
            })).filter((item) => !localSignatures.has(getHistorySignature(item)));

            const merged = [...mapped, ...localRecords];
            detectionHistory = merged.slice(0, 1000);
            renderHistoryTable();
        }
    } catch {
    }
}

function addToLocalHistory(content, result, isLocal) {
    const record = {
        id: createId(),
        content,
        result: result.label,
        confidence: Number(result.confidence || 0),
        lang: result.lang || currentLang,
        source: isLocal ? 'local' : 'backend',
        time: new Date().toISOString()
    };
    detectionHistory.unshift(record);
    detectionHistory = detectionHistory.slice(0, 1000);
    saveHistory();
}

function mergeBatchResultsToHistory(items) {
    const records = items
        .filter((item) => !item.error && item.label)
        .map((item) => ({
            id: createId(),
            content: item.content || '',
            result: item.label,
            confidence: Number(item.confidence || 0),
            lang: item.lang || currentBatchLang,
            source: 'local',
            time: new Date().toISOString()
        }));

    detectionHistory = [...records.reverse(), ...detectionHistory].slice(0, 1000);
    saveHistory();
}

function getFilteredHistory() {
    const keyword = (searchInput.value || '').trim().toLowerCase();
    const filter = resultFilter.value;

    return detectionHistory.filter((record) => {
        const byKeyword = !keyword || (record.content || '').toLowerCase().includes(keyword);
        const byResult = filter === 'all' || record.result === filter;
        return byKeyword && byResult;
    });
}

function getHistoryTotalPages() {
    return Math.max(1, Math.ceil(getFilteredHistory().length / historyPageSize));
}

function renderHistoryTable() {
    const filtered = getFilteredHistory();
    const totalPages = Math.max(1, Math.ceil(filtered.length / historyPageSize));
    if (currentHistoryPage > totalPages) {
        currentHistoryPage = totalPages;
    }

    const start = (currentHistoryPage - 1) * historyPageSize;
    const pageRows = filtered.slice(start, start + historyPageSize);

    historyTotalInfo.textContent = `共 ${filtered.length} 条`;
    historyPageInfo.textContent = `第 ${currentHistoryPage} / ${totalPages} 页`;
    historyPrevBtn.disabled = currentHistoryPage <= 1;
    historyNextBtn.disabled = currentHistoryPage >= totalPages;

    if (!pageRows.length) {
        historyTableBody.innerHTML = '<tr><td colspan="6" class="muted center">暂无记录</td></tr>';
        return;
    }

    historyTableBody.innerHTML = pageRows.map((record, index) => `
        <tr>
            <td>${start + index + 1}</td>
            <td>${escapeHtml(truncateText(record.content || '', 60))}</td>
            <td><span class="badge ${record.result}">${formatLabel(record.result)}</span></td>
            <td>${formatPercentage(record.confidence)}</td>
            <td>${record.lang === 'zh' ? '中文' : '英文'}</td>
            <td>${formatTime(record.time)}</td>
        </tr>
    `).join('');
}

function exportHistoryAsCSV() {
    const rows = getFilteredHistory();
    if (!rows.length) {
        showError('没有可导出的记录。');
        return;
    }

    const csv = [
        '内容,结果,置信度,模型,时间',
        ...rows.map((record) => [
            csvEscape(record.content),
            csvEscape(formatLabel(record.result)),
            csvEscape(formatPercentage(record.confidence)),
            csvEscape(record.lang === 'zh' ? '中文' : '英文'),
            csvEscape(formatTime(record.time))
        ].join(','))
    ].join('\n');

    downloadCsv(csv, `detection-history-${Date.now()}.csv`);
}

function clearLocalHistory() {
    const localCount = detectionHistory.filter((item) => item.source !== 'backend').length;
    if (!localCount) {
        showToast('当前没有本地记录可清空');
        return;
    }

    const confirmed = window.confirm(`确定清空 ${localCount} 条本地记录吗？`);
    if (!confirmed) {
        return;
    }

    detectionHistory = detectionHistory.filter((item) => item.source === 'backend');
    currentHistoryPage = 1;
    saveHistory();
    renderHistoryTable();
    showToast(`已清空 ${localCount} 条本地记录`);
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
}

function handleTemplateActions(event) {
    const target = event.target;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) {
        return;
    }

    const template = templates.find((item) => item.id === id);
    if (!template) {
        return;
    }

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
    if (!templates.length) {
        templateTableBody.innerHTML = '<tr><td colspan="4" class="muted center">暂无模板</td></tr>';
        return;
    }

    templateTableBody.innerHTML = templates.map((item) => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.lang === 'zh' ? '中文' : '英文'}</td>
            <td>${escapeHtml(truncateText(item.content, 72))}</td>
            <td>
                <button class="btn btn-xs" data-action="use" data-id="${item.id}">填充</button>
                <button class="btn btn-xs" data-action="delete" data-id="${item.id}">删除</button>
            </td>
        </tr>
    `).join('');
}

async function loadKeywordRules() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/keyword-rules`);
        const data = await response.json();
        if (response.ok && data.code === 200 && data.data) {
            keywordRules = normalizeKeywordRules(data.data);
            renderKeywordLists();
        }
    } catch {
    }
}

async function saveKeywordRules() {
    hideBatchError();
    try {
        const response = await fetch(`${API_BASE_URL}/detection/keyword-rules`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keywordRules)
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '保存失败');
        }
        keywordRules = normalizeKeywordRules(data.data);
        renderKeywordLists();
    } catch (error) {
        showBatchError(`保存规则失败：${error.message}`);
    }
}

function addKeyword(key, input) {
    const value = input.value.trim();
    if (!value) {
        return;
    }
    const currentList = Array.isArray(keywordRules[key]) ? keywordRules[key] : [];
    if (!currentList.includes(value)) {
        keywordRules[key] = [...currentList, value];
        renderKeywordLists();
    }
    input.value = '';
}

function handleKeywordActions(event) {
    const button = event.target.closest('button[data-action="delete-keyword"]');
    if (!button) {
        return;
    }

    const key = button.dataset.key;
    const value = decodeURIComponent(button.dataset.value || '');
    keywordRules[key] = (keywordRules[key] || []).filter((item) => item !== value);
    renderKeywordLists();
}

function renderKeywordLists() {
    renderKeywordList(strongWhitelistList, keywordRules.strongWhitelistKeywords, 'strong-whitelist', 'strongWhitelistKeywords');
    renderKeywordList(strongBlacklistList, keywordRules.strongBlacklistKeywords, 'strong-blacklist', 'strongBlacklistKeywords');
    renderKeywordList(weakWhitelistList, keywordRules.weakWhitelistKeywords, 'weak-whitelist', 'weakWhitelistKeywords');
    renderKeywordList(weakBlacklistList, keywordRules.weakBlacklistKeywords, 'weak-blacklist', 'weakBlacklistKeywords');
}

function renderKeywordList(container, keywords, visualType, key) {
    if (!keywords || !keywords.length) {
        container.innerHTML = '<div class="muted">暂无关键词</div>';
        return;
    }

    container.innerHTML = keywords.map((keyword) => `
        <span class="keyword-chip ${visualType}">
            ${escapeHtml(keyword)}
            <button type="button" title="删除关键词" aria-label="删除关键词" data-action="delete-keyword" data-key="${key}" data-value="${encodeURIComponent(keyword)}">×</button>
        </span>
    `).join('');
}

async function submitSingleFeedback() {
    const content = smsInput.value.trim();
    if (!lastResult || !content) {
        showError('当前没有可纠错的检测结果。');
        return;
    }

    openFeedbackModal({
        content,
        predictedLabel: lastResult.label,
        lang: lastResult.lang || currentLang,
        sourceType: 'single',
        rowNo: 'single',
        decisionSource: lastResult.decisionSource,
        ruleNote: lastResult.ruleNote
    });
}

async function loadFeedbackSamples() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/feedback`);
        const data = await response.json();
        if (response.ok && data.code === 200 && Array.isArray(data.data)) {
            feedbackSamples = data.data;
            renderFeedbackTable();
            submittedFeedbackKeys = new Set(
                feedbackSamples.map((item) => getFeedbackKey(item.smsContent, item.sourceType === 'batch' ? 'batch' : 'single'))
            );
        }
    } catch {
    }
}

async function loadKeywordStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/feedback/keyword-stats`);
        const data = await response.json();
        if (response.ok && data.code === 200 && Array.isArray(data.data)) {
            keywordStats = data.data;
            renderKeywordStatsTable();
        }
    } catch {
    }
}

async function exportAcceptedSamples() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/feedback/export`);
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '导出失败');
        }

        downloadBase64File(data.data.fileBase64, data.data.fileName, 'text/csv;charset=utf-8;');
        showToast(`已导出 ${data.data.sampleCount || 0} 条已采纳样本`);
    } catch (error) {
        showBatchError(`导出已采纳样本失败：${error.message}`);
    }
}

async function generateTrainingDataset() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/feedback/generate-training-dataset`, {
            method: 'POST'
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '生成失败');
        }

        const info = data.data;
        showToast(`训练集已生成并完成重训练：英文 ${info.englishSampleCount} 条，中文 ${info.chineseSampleCount} 条`);
    } catch (error) {
        showBatchError(`生成训练集文件失败：${error.message}`);
    }
}

function renderFeedbackTable() {
    if (!feedbackSamples.length) {
        feedbackTableBody.innerHTML = '<tr><td colspan="8" class="muted center">暂无待审核样本</td></tr>';
        return;
    }

    feedbackTableBody.innerHTML = feedbackSamples.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(truncateText(item.smsContent || '', 60))}</td>
            <td><span class="badge ${item.predictedLabel}">${formatLabel(item.predictedLabel)}</span></td>
            <td><span class="badge ${item.correctedLabel}">${formatLabel(item.correctedLabel)}</span></td>
            <td>${item.sourceType === 'batch' ? '批量检测' : '单条检测'}</td>
            <td><span class="review-status ${item.status || 'pending'}">${formatFeedbackStatus(item.status)}</span></td>
            <td>${formatTime(item.createdAt)}</td>
            <td>${renderFeedbackActions(item)}</td>
        </tr>
    `).join('');
}

function renderKeywordStatsTable() {
    if (!keywordStats.length) {
        keywordStatsTableBody.innerHTML = '<tr><td colspan="3" class="muted center">暂无统计数据</td></tr>';
        return;
    }

    keywordStatsTableBody.innerHTML = keywordStats.map((item) => `
        <tr>
            <td>${escapeHtml(item.keyword)}</td>
            <td>${escapeHtml(item.ruleType)}</td>
            <td>${item.hitCount || 0}</td>
        </tr>
    `).join('');
}

function renderFeedbackActions(item) {
    if (item.status && item.status !== 'pending') {
        return `
            <span class="muted">已处理</span>
            <button class="btn btn-xs btn-danger" data-action="delete-feedback" data-id="${item.id}">删除</button>
        `;
    }
    return `
        <button class="btn btn-xs" data-action="accept-feedback" data-id="${item.id}">采纳</button>
        <button class="btn btn-xs" data-action="ignore-feedback" data-id="${item.id}">忽略</button>
        <button class="btn btn-xs btn-danger" data-action="delete-feedback" data-id="${item.id}">删除</button>
    `;
}

function handleFeedbackTableActions(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
        return;
    }

    const id = Number(button.dataset.id);
    if (!id) {
        return;
    }

    if (button.dataset.action === 'accept-feedback') {
        updateFeedbackStatus(id, 'accepted').catch((error) => showBatchError(`更新状态失败：${error.message}`));
        return;
    }
    if (button.dataset.action === 'ignore-feedback') {
        updateFeedbackStatus(id, 'ignored').catch((error) => showBatchError(`更新状态失败：${error.message}`));
        return;
    }
    if (button.dataset.action === 'delete-feedback') {
        const confirmed = window.confirm('删除后该待审核样本将无法恢复，是否继续？');
        if (!confirmed) {
            return;
        }
        deleteFeedbackSample(id).catch((error) => showBatchError(`删除待审核样本失败：${error.message}`));
    }
}

function openFeedbackModal(payload) {
    pendingFeedbackPayload = payload;
    feedbackPreviewText.textContent = truncateText(payload.content || '-', 80);
    feedbackModal.style.display = 'flex';
    showToast('请选择纠错后的短信类别。');
}

function closeFeedbackModal() {
    pendingFeedbackPayload = null;
    feedbackModal.style.display = 'none';
}

function handleFeedbackModalActions(event) {
    if (event.target === feedbackModal) {
        closeFeedbackModal();
        return;
    }

    const choice = event.target.closest('.feedback-choice');
    if (!choice || !pendingFeedbackPayload) {
        return;
    }

    submitFeedbackPayload({
        ...pendingFeedbackPayload,
        correctedLabel: choice.dataset.label
    }).then(() => {
        submittedFeedbackKeys.add(getFeedbackKey(pendingFeedbackPayload.content, pendingFeedbackPayload.rowNo));
        closeFeedbackModal();
        loadFeedbackSamples();
        if (lastBatchResult && Array.isArray(lastBatchResult.items)) {
            renderBatchTable(lastBatchResult.items);
        }
        showToast(`纠错已提交：${formatLabel(choice.dataset.label)}`);
    }).catch((error) => {
        closeFeedbackModal();
        showBatchError(`提交纠错失败：${error.message}`);
    });
}

async function submitFeedbackPayload(payload) {
    const response = await fetch(`${API_BASE_URL}/detection/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || data.code !== 200) {
        throw new Error(data.message || '提交失败');
    }
    return data.data;
}

async function updateFeedbackStatus(id, status) {
    const response = await fetch(`${API_BASE_URL}/detection/feedback/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok || data.code !== 200) {
        throw new Error(data.message || '更新失败');
    }
    await loadFeedbackSamples();
    await loadKeywordStats();
    showToast(`样本已${status === 'accepted' ? '采纳' : '忽略'}`);
}

async function deleteFeedbackSample(id) {
    const response = await fetch(`${API_BASE_URL}/detection/feedback/${id}`, {
        method: 'DELETE'
    });
    const data = await response.json();
    if (!response.ok || data.code !== 200) {
        throw new Error(data.message || '删除失败');
    }
    await loadFeedbackSamples();
    await loadKeywordStats();
    showToast('待审核样本已删除');
}

function loadSavedData() {
    try {
        detectionHistory = JSON.parse(localStorage.getItem(HISTORY_STORE_KEY) || '[]');
        if (!Array.isArray(detectionHistory)) {
            detectionHistory = [];
        }
    } catch {
        detectionHistory = [];
    }

    try {
        templates = JSON.parse(localStorage.getItem(TEMPLATE_STORE_KEY) || '[]');
        if (!Array.isArray(templates) || !templates.length) {
            templates = DEFAULT_TEMPLATES;
        }
    } catch {
        templates = DEFAULT_TEMPLATES;
    }

    saveTemplates();
}

function saveHistory() {
    const localRecords = detectionHistory.filter((item) => item.source !== 'backend');
    if (!localRecords.length) {
        localStorage.removeItem(HISTORY_STORE_KEY);
        return;
    }
    localStorage.setItem(HISTORY_STORE_KEY, JSON.stringify(localRecords));
}

function saveTemplates() {
    localStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(templates));
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
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    themeToggleBtn.textContent = theme === 'dark' ? '☀' : '🌙';
    themeToggleBtn.title = theme === 'dark' ? '切换亮色模式' : '切换黑夜模式';
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
});





