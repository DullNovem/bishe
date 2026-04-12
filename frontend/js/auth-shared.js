const AUTH_API_BASE_URL = 'http://localhost:8080/api';
const AUTH_CURRENT_USER_KEY = 'sms_current_user_v1';
const AUTH_TOKEN_KEY = 'sms_auth_token_v1';
const AUTH_LOGIN_FLAG_KEY = 'sms_login_flag_v1';
const AUTH_NOTICE_KEY = 'sms_auth_notice_v1';
const AUTH_CLEAR_KEYS = [
    AUTH_CURRENT_USER_KEY,
    AUTH_TOKEN_KEY,
    AUTH_LOGIN_FLAG_KEY,
    'token',
    'accessToken',
    'authToken',
    'jwt'
];

function authGetUser() {
    try {
        return JSON.parse(sessionStorage.getItem(AUTH_CURRENT_USER_KEY) || 'null');
    } catch {
        return null;
    }
}

function authIsLoggedIn() {
    const user = authGetUser();
    return !!(user && user.id && sessionStorage.getItem(AUTH_LOGIN_FLAG_KEY) === '1');
}

function authPersistUser(user) {
    const token = user?.token || user?.accessToken || user?.authToken || `session_${user.id}_${Date.now()}`;
    sessionStorage.setItem(AUTH_CURRENT_USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(AUTH_LOGIN_FLAG_KEY, '1');
}

function authClearState() {
    AUTH_CLEAR_KEYS.forEach((key) => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    });
}

function authSetNotice(type, message) {
    sessionStorage.setItem(AUTH_NOTICE_KEY, JSON.stringify({ type, message }));
}

function authConsumeNotice() {
    try {
        const raw = sessionStorage.getItem(AUTH_NOTICE_KEY);
        sessionStorage.removeItem(AUTH_NOTICE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        sessionStorage.removeItem(AUTH_NOTICE_KEY);
        return null;
    }
}
