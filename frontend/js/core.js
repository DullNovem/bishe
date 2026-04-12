const API_BASE_URL = 'http://localhost:8080/api';
const STATS_REFRESH_INTERVAL = 5000;
const HISTORY_STORE_KEY = 'sms_detection_history_v3';
const TEMPLATE_STORE_KEY = 'sms_templates_v1';
const THEME_STORE_KEY = 'sms_theme_mode_v1';
const CURRENT_USER_STORE_KEY = 'sms_current_user_v1';
const AUTH_TOKEN_STORE_KEY = 'sms_auth_token_v1';
const AUTH_LOGIN_FLAG_KEY = 'sms_login_flag_v1';
const AUTH_NOTICE_STORE_KEY = 'sms_auth_notice_v1';
const LOGIN_PATH = '/login';
const REGISTER_PATH = '/register';
const DASHBOARD_PATH = '/dashboard';
const CURRENT_ROUTE = document.body.dataset.route || 'dashboard';
const AUTH_STATE_KEYS = [
    CURRENT_USER_STORE_KEY,
    AUTH_TOKEN_STORE_KEY,
    AUTH_LOGIN_FLAG_KEY,
    'token',
    'accessToken',
    'authToken',
    'jwt'
];

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
let lastTrendPoints = [];
let lastKeywordInsights = [];
let currentBatchFile = null;
let currentBatchTaskId = null;
let statsTimer = null;
let batchTaskTimer = null;
let probabilityChart = null;
let pieChart = null;
let trendChart = null;
let keywordInsightChart = null;
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
const authSuccess = document.getElementById('authSuccess');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserChip = document.getElementById('currentUserChip');
const registerUsername = document.getElementById('registerUsername');
const registerDisplayName = document.getElementById('registerDisplayName');
const registerPhone = document.getElementById('registerPhone');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerConfirmPassword = document.getElementById('registerConfirmPassword');
const registerUsernameMessage = document.getElementById('registerUsernameMessage');
const registerDisplayNameMessage = document.getElementById('registerDisplayNameMessage');
const registerPhoneMessage = document.getElementById('registerPhoneMessage');
const registerEmailMessage = document.getElementById('registerEmailMessage');
const registerPasswordMessage = document.getElementById('registerPasswordMessage');
const registerConfirmPasswordMessage = document.getElementById('registerConfirmPasswordMessage');

const smsInput = document.getElementById('smsInput');
const charCount = document.getElementById('charCount');
const detectBtn = document.getElementById('detectBtn');
const resetBtn = document.getElementById('resetBtn');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
const resultRiskScore = document.getElementById('resultRiskScore');
const resultExplanationSummary = document.getElementById('resultExplanationSummary');
const resultKeywordChips = document.getElementById('resultKeywordChips');
const resultExplanationList = document.getElementById('resultExplanationList');

const totalDetections = document.getElementById('totalDetections');
const spamCount = document.getElementById('spamCount');
const suspiciousCount = document.getElementById('suspiciousCount');
const normalCount = document.getElementById('normalCount');
const trendChartEl = document.getElementById('trendChart');
const keywordInsightChartEl = document.getElementById('keywordInsightChart');
const keywordInsightList = document.getElementById('keywordInsightList');

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
const batchTaskStatusCard = document.getElementById('batchTaskStatusCard');
const batchTaskStatusText = document.getElementById('batchTaskStatusText');
const batchTaskId = document.getElementById('batchTaskId');
const batchTaskPhase = document.getElementById('batchTaskPhase');
const batchTaskFileName = document.getElementById('batchTaskFileName');
const batchTaskProcessed = document.getElementById('batchTaskProcessed');

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

function createBootstrapId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_TEMPLATES = [
    {
        id: createBootstrapId(),
        name: '中奖诱导样本',
        lang: 'zh',
        content: '恭喜您获得现金大奖，请点击链接领取并填写银行卡信息。'
    },
    {
        id: createBootstrapId(),
        name: '官方验证码样本',
        lang: 'zh',
        content: '【银行】您的验证码为 123456，5 分钟内有效。'
    }
];

