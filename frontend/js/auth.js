function getLoginUrl() {
    return LOGIN_PATH;
}

function getRegisterUrl() {
    return REGISTER_PATH;
}

function getDashboardUrl() {
    return DASHBOARD_PATH;
}

function setAuthNotice(type, message) {
    sessionStorage.setItem(AUTH_NOTICE_STORE_KEY, JSON.stringify({ type, message }));
}

function consumeAuthNotice() {
    try {
        const raw = sessionStorage.getItem(AUTH_NOTICE_STORE_KEY);
        sessionStorage.removeItem(AUTH_NOTICE_STORE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        sessionStorage.removeItem(AUTH_NOTICE_STORE_KEY);
        return null;
    }
}

function showAuthSuccess(message) {
    if (!authSuccess) {
        return;
    }
    authSuccess.style.display = 'block';
    authSuccess.textContent = message;
}

function hideAuthSuccess() {
    if (!authSuccess) {
        return;
    }
    authSuccess.style.display = 'none';
    authSuccess.textContent = '';
}

function initializeAuth() {
    hideAuthError();
    hideAuthSuccess();
    bindRegisterValidation();

    const notice = consumeAuthNotice();
    if (notice?.type === 'success') {
        showAuthSuccess(notice.message);
    } else if (notice?.type === 'error') {
        showAuthError(notice.message);
    }
}

function bindAuthPageEventListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

function isAuthenticated() {
    return !!(currentUser && currentUser.id && sessionStorage.getItem(AUTH_LOGIN_FLAG_KEY) === '1');
}

function clearAuthStateStorage() {
    AUTH_STATE_KEYS.forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    });
}

function resetProtectedState() {
    detectionHistory = [];
    templates = [...DEFAULT_TEMPLATES];
    keywordRules = normalizeKeywordRules({});
    feedbackSamples = [];
    keywordStats = [];
    lastStats = null;
    lastResult = null;
    lastBatchResult = null;
    lastTrendPoints = [];
    lastKeywordInsights = [];
    currentBatchFile = null;
    currentBatchTaskId = null;
    pendingFeedbackPayload = null;
    submittedFeedbackKeys = new Set();
    currentHistoryPage = 1;
    historyPageSize = Number(pageSizeSelect?.value) || 10;

    if (statsTimer) {
        clearInterval(statsTimer);
        statsTimer = null;
    }
    if (batchTaskTimer) {
        clearInterval(batchTaskTimer);
        batchTaskTimer = null;
    }
    if (probabilityChart) {
        probabilityChart.dispose();
        probabilityChart = null;
    }
    if (trendChart) {
        trendChart.dispose();
        trendChart = null;
    }
    if (keywordInsightChart) {
        keywordInsightChart.dispose();
        keywordInsightChart = null;
    }
    pieChart = null;
}

function updateAuthUI() {
    if (authShell) {
        authShell.classList.toggle('hidden', CURRENT_ROUTE !== 'login' && CURRENT_ROUTE !== 'register');
    }
    if (appShell) {
        appShell.classList.toggle('hidden', CURRENT_ROUTE !== 'dashboard');
    }
    if (currentUserChip) {
        currentUserChip.textContent = isAuthenticated()
            ? `${currentUser.displayName || currentUser.username} / ${currentUser.username}`
            : '\u672a\u767b\u5f55';
    }
}

function restoreCurrentUser() {
    try {
        currentUser = JSON.parse(sessionStorage.getItem(CURRENT_USER_STORE_KEY) || 'null');
    } catch {
        currentUser = null;
    }

    if (!isAuthenticated()) {
        clearAuthStateStorage();
        currentUser = null;
    }
    updateAuthUI();
}

function redirectToLogin() {
    if (window.location.pathname !== LOGIN_PATH) {
        window.location.replace(getLoginUrl());
    }
}

function redirectToRegister() {
    if (window.location.pathname !== REGISTER_PATH) {
        window.location.replace(getRegisterUrl());
    }
}

function redirectToDashboard() {
    if (window.location.pathname !== DASHBOARD_PATH && window.location.pathname !== '/') {
        window.location.replace(getDashboardUrl());
    } else if (window.location.pathname === '/') {
        window.location.replace(getDashboardUrl());
    }
}

function requireAuth(options = {}) {
    if (isAuthenticated()) {
        return true;
    }

    clearCurrentUser();
    if (options.noticeMessage) {
        setAuthNotice('error', options.noticeMessage);
    }
    redirectToLogin();
    return false;
}

function persistCurrentUser(user) {
    currentUser = user;
    const token = user?.token || user?.accessToken || user?.authToken || `session_${user.id}_${Date.now()}`;
    sessionStorage.setItem(CURRENT_USER_STORE_KEY, JSON.stringify(user));
    sessionStorage.setItem(AUTH_TOKEN_STORE_KEY, token);
    sessionStorage.setItem(AUTH_LOGIN_FLAG_KEY, '1');
    updateAuthUI();
}

function clearCurrentUser() {
    currentUser = null;
    resetProtectedState();
    clearAuthStateStorage();
    updateAuthUI();
}

function getCurrentUserId() {
    return currentUser?.id || null;
}

function getScopedStorageKey(baseKey) {
    const userId = getCurrentUserId();
    return userId ? `${baseKey}_${userId}` : baseKey;
}

function withUserQuery(url) {
    const userId = getCurrentUserId();
    if (!userId) {
        return url;
    }
    return `${url}${url.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userId)}`;
}

function setAuthSubmitting(form, isSubmitting, text) {
    if (!form) {
        return;
    }
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) {
        return;
    }
    if (!submitButton.dataset.defaultText) {
        submitButton.dataset.defaultText = submitButton.textContent;
    }
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? text : submitButton.dataset.defaultText;
}

async function handleLogin(event) {
    event.preventDefault();
    hideAuthError();
    hideAuthSuccess();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username) {
        showAuthError('\u8d26\u53f7\u4e0d\u80fd\u4e3a\u7a7a');
        return;
    }
    if (!password) {
        showAuthError('\u5bc6\u7801\u4e0d\u80fd\u4e3a\u7a7a');
        return;
    }

    setAuthSubmitting(loginForm, true, '\u767b\u5f55\u4e2d...');
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '\u767b\u5f55\u5931\u8d25');
        }
        persistCurrentUser(data.data);
        loginForm.reset();
        redirectToDashboard();
    } catch (error) {
        showAuthError(error.message || '\u767b\u5f55\u5931\u8d25');
    } finally {
        setAuthSubmitting(loginForm, false, '');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    hideAuthError();
    hideAuthSuccess();

    const validation = validateRegisterForm(true);
    if (!validation.valid) {
        showAuthError(validation.message || '\u8bf7\u5148\u6309\u63d0\u793a\u5b8c\u5584\u6ce8\u518c\u4fe1\u606f');
        return;
    }

    const payload = {
        username: registerUsername.value.trim(),
        displayName: registerDisplayName.value.trim(),
        phone: registerPhone.value.trim(),
        email: registerEmail.value.trim(),
        password: registerPassword.value
    };

    setAuthSubmitting(registerForm, true, '\u6ce8\u518c\u4e2d...');
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '\u6ce8\u518c\u5931\u8d25');
        }

        registerForm.reset();
        setAuthNotice('success', '\u6ce8\u518c\u6210\u529f\uff0c\u8bf7\u767b\u5f55');
        redirectToLogin();
    } catch (error) {
        showAuthError(error.message || '\u6ce8\u518c\u5931\u8d25');
    } finally {
        setAuthSubmitting(registerForm, false, '');
    }
}

function handleLogout() {
    clearCurrentUser();
    setAuthNotice('success', '\u5df2\u9000\u51fa\u767b\u5f55\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55');
    redirectToLogin();
}

function showAuthError(message) {
    hideAuthSuccess();
    if (!authError) {
        return;
    }
    authError.style.display = 'block';
    authError.textContent = message;
}

function hideAuthError() {
    if (!authError) {
        return;
    }
    authError.style.display = 'none';
    authError.textContent = '';
}

function bindRegisterValidation() {
    [
        [registerUsername, registerUsernameMessage, validateUsername],
        [registerDisplayName, registerDisplayNameMessage, validateDisplayName],
        [registerPhone, registerPhoneMessage, validatePhone],
        [registerEmail, registerEmailMessage, validateEmail],
        [registerPassword, registerPasswordMessage, validatePassword],
        [registerConfirmPassword, registerConfirmPasswordMessage, validateConfirmPassword]
    ].forEach(([input, messageEl, validator]) => {
        if (!input || !messageEl) {
            return;
        }
        input.addEventListener('input', () => {
            applyFieldValidation(input, messageEl, validator(input.value), false);
        });
        input.addEventListener('blur', () => {
            applyFieldValidation(input, messageEl, validator(input.value), true);
        });
    });
}

function validateRegisterForm(forceShow) {
    const usernameState = applyFieldValidation(registerUsername, registerUsernameMessage, validateUsername(registerUsername?.value), forceShow);
    const displayNameState = applyFieldValidation(registerDisplayName, registerDisplayNameMessage, validateDisplayName(registerDisplayName?.value), forceShow);
    const phoneState = applyFieldValidation(registerPhone, registerPhoneMessage, validatePhone(registerPhone?.value), forceShow);
    const emailState = applyFieldValidation(registerEmail, registerEmailMessage, validateEmail(registerEmail?.value), forceShow);
    const passwordState = applyFieldValidation(registerPassword, registerPasswordMessage, validatePassword(registerPassword?.value), forceShow);
    const confirmPasswordState = applyFieldValidation(
        registerConfirmPassword,
        registerConfirmPasswordMessage,
        validateConfirmPassword(registerConfirmPassword?.value),
        forceShow
    );

    const valid = usernameState && displayNameState && phoneState && emailState && passwordState && confirmPasswordState;
    return {
        valid,
        message: valid ? '' : '\u8bf7\u5148\u6309\u63d0\u793a\u5b8c\u5584\u6ce8\u518c\u4fe1\u606f'
    };
}

function applyFieldValidation(input, messageEl, state, forceShow) {
    if (!input || !messageEl) {
        return state.valid;
    }

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
        return { valid: false, message: '\u8bf7\u8f93\u5165\u7528\u6237\u540d' };
    }
    if (text.length < 4 || text.length > 32) {
        return { valid: false, message: '\u7528\u6237\u540d\u957f\u5ea6\u9700\u5728 4 \u5230 32 \u4f4d\u4e4b\u95f4' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(text)) {
        return { valid: false, message: '\u7528\u6237\u540d\u4ec5\u652f\u6301\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u4e0b\u5212\u7ebf' };
    }
    return { valid: true, message: '\u7528\u6237\u540d\u683c\u5f0f\u53ef\u7528' };
}

function validateDisplayName(value) {
    const text = String(value || '').trim();
    if (!text) {
        return { valid: false, message: '\u8bf7\u8f93\u5165\u663e\u793a\u540d\u79f0' };
    }
    if (text.length < 2 || text.length > 32) {
        return { valid: false, message: '\u663e\u793a\u540d\u79f0\u957f\u5ea6\u9700\u5728 2 \u5230 32 \u4f4d\u4e4b\u95f4' };
    }
    return { valid: true, message: '\u663e\u793a\u540d\u79f0\u53ef\u7528' };
}

function validatePhone(value) {
    const text = String(value || '').trim();
    if (!text) {
        return { valid: true, message: '\u624b\u673a\u53f7\u53ef\u9009' };
    }
    if (!/^1\d{10}$/.test(text)) {
        return { valid: false, message: '\u8bf7\u8f93\u5165\u6709\u6548\u7684 11 \u4f4d\u624b\u673a\u53f7' };
    }
    return { valid: true, message: '\u624b\u673a\u53f7\u683c\u5f0f\u6b63\u786e' };
}

function validateEmail(value) {
    const text = String(value || '').trim();
    if (!text) {
        return { valid: true, message: '\u90ae\u7bb1\u53ef\u9009' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        return { valid: false, message: '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740' };
    }
    return { valid: true, message: '\u90ae\u7bb1\u683c\u5f0f\u6b63\u786e' };
}

function validatePassword(value) {
    const text = String(value || '');
    if (!text) {
        return { valid: false, message: '\u8bf7\u8f93\u5165\u5bc6\u7801' };
    }
    if (text.length < 6 || text.length > 32) {
        return { valid: false, message: '\u5bc6\u7801\u957f\u5ea6\u9700\u5728 6 \u5230 32 \u4f4d\u4e4b\u95f4' };
    }
    if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) {
        return { valid: false, message: '\u5bc6\u7801\u9700\u540c\u65f6\u5305\u542b\u5b57\u6bcd\u548c\u6570\u5b57' };
    }
    return { valid: true, message: '\u5bc6\u7801\u5f3a\u5ea6\u53ef\u7528' };
}

function validateConfirmPassword(value) {
    const text = String(value || '');
    if (!text) {
        return { valid: false, message: '\u8bf7\u518d\u6b21\u8f93\u5165\u5bc6\u7801' };
    }
    if (text !== String(registerPassword?.value || '')) {
        return { valid: false, message: '\u4e24\u6b21\u8f93\u5165\u7684\u5bc6\u7801\u4e0d\u4e00\u81f4' };
    }
    return { valid: true, message: '\u4e24\u6b21\u5bc6\u7801\u4e00\u81f4' };
}
