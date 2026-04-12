function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_STORE_KEY) || 'light';
    applyTheme(savedTheme);

    if (!themeToggleBtn) {
        return;
    }

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
            if (!requireAuth({ noticeMessage: '请先登录后再进入后台页面' })) {
                return;
            }
            const page = item.dataset.page;
            menuItems.forEach((element) => element.classList.remove('active'));
            item.classList.add('active');
            pages.forEach((pageElement) => pageElement.classList.remove('active'));
            const targetPage = document.getElementById(`page-${page}`);
            if (targetPage) {
                targetPage.classList.add('active');
            }
            if (pageTitle) {
                pageTitle.textContent = PAGE_TITLES[page] || '管理系统';
            }

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
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (detectBtn) {
        detectBtn.addEventListener('click', handleDetection);
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', resetDetectionForm);
    }
    if (submitFeedbackBtn) {
        submitFeedbackBtn.addEventListener('click', submitSingleFeedback);
    }

    if (smsInput) {
        smsInput.addEventListener('input', updateCharCount);
        smsInput.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                handleDetection();
            }
        });
    }

    const langSegment = document.getElementById('langSegment');
    if (langSegment) {
        langSegment.addEventListener('click', handleLanguageSwitch);
    }
    const batchLangSegment = document.getElementById('batchLangSegment');
    if (batchLangSegment) {
        batchLangSegment.addEventListener('click', handleBatchLanguageSwitch);
    }

    if (triggerUploadBtn && batchFileInput) {
        triggerUploadBtn.addEventListener('click', () => batchFileInput.click());
    }
    if (batchFileInput) {
        batchFileInput.addEventListener('change', handleBatchFileChange);
    }
    if (batchDetectBtn) {
        batchDetectBtn.addEventListener('click', handleBatchDetection);
    }
    if (downloadBatchReportBtn) {
        downloadBatchReportBtn.addEventListener('click', downloadBatchReport);
    }
    if (batchTableBody) {
        batchTableBody.addEventListener('click', handleBatchTableActions);
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentHistoryPage = 1;
            renderHistoryTable();
        });
    }
    if (resultFilter) {
        resultFilter.addEventListener('change', () => {
            currentHistoryPage = 1;
            renderHistoryTable();
        });
    }
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            historyPageSize = Number(pageSizeSelect.value) || 10;
            currentHistoryPage = 1;
            renderHistoryTable();
        });
    }
    if (historyPrevBtn) {
        historyPrevBtn.addEventListener('click', () => {
            if (currentHistoryPage > 1) {
                currentHistoryPage -= 1;
                renderHistoryTable();
            }
        });
    }
    if (historyNextBtn) {
        historyNextBtn.addEventListener('click', () => {
            const totalPages = getHistoryTotalPages();
            if (currentHistoryPage < totalPages) {
                currentHistoryPage += 1;
                renderHistoryTable();
            }
        });
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', exportHistoryAsCSV);
    }
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearLocalHistory);
    }

    if (addTplBtn) {
        addTplBtn.addEventListener('click', addTemplate);
    }
    if (templateTableBody) {
        templateTableBody.addEventListener('click', handleTemplateActions);
    }

    if (addStrongWhitelistBtn) {
        addStrongWhitelistBtn.addEventListener('click', () => addKeyword('strongWhitelistKeywords', strongWhitelistInput));
    }
    if (addStrongBlacklistBtn) {
        addStrongBlacklistBtn.addEventListener('click', () => addKeyword('strongBlacklistKeywords', strongBlacklistInput));
    }
    if (addWeakWhitelistBtn) {
        addWeakWhitelistBtn.addEventListener('click', () => addKeyword('weakWhitelistKeywords', weakWhitelistInput));
    }
    if (addWeakBlacklistBtn) {
        addWeakBlacklistBtn.addEventListener('click', () => addKeyword('weakBlacklistKeywords', weakBlacklistInput));
    }
    if (saveRulesBtn) {
        saveRulesBtn.addEventListener('click', saveKeywordRules);
    }
    if (strongWhitelistList) {
        strongWhitelistList.addEventListener('click', handleKeywordActions);
    }
    if (strongBlacklistList) {
        strongBlacklistList.addEventListener('click', handleKeywordActions);
    }
    if (weakWhitelistList) {
        weakWhitelistList.addEventListener('click', handleKeywordActions);
    }
    if (weakBlacklistList) {
        weakBlacklistList.addEventListener('click', handleKeywordActions);
    }

    if (refreshFeedbackBtn) {
        refreshFeedbackBtn.addEventListener('click', loadFeedbackSamples);
    }
    if (exportAcceptedBtn) {
        exportAcceptedBtn.addEventListener('click', exportAcceptedSamples);
    }
    if (generateTrainingDatasetBtn) {
        generateTrainingDatasetBtn.addEventListener('click', generateTrainingDataset);
    }
    if (feedbackTableBody) {
        feedbackTableBody.addEventListener('click', handleFeedbackTableActions);
    }
    if (closeFeedbackModalBtn) {
        closeFeedbackModalBtn.addEventListener('click', closeFeedbackModal);
    }
    if (feedbackModal) {
        feedbackModal.addEventListener('click', handleFeedbackModalActions);
    }
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
    if (!smsInput) {
        return;
    }
    document.querySelectorAll('#langSegment .seg-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.lang === currentLang);
    });
    const langTip = document.getElementById('langTip');
    if (langTip) {
        langTip.textContent = currentLang === 'zh' ? '当前模型：中文' : '当前模型：英文';
    }
    smsInput.placeholder = currentLang === 'zh' ? '请输入待检测的中文短信内容...' : 'Enter SMS content...';
}

function updateBatchLanguageUI() {
    if (!batchLangTip) {
        return;
    }
    document.querySelectorAll('#batchLangSegment .seg-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.lang === currentBatchLang);
    });
    batchLangTip.textContent = currentBatchLang === 'zh' ? '当前模型：中文' : '当前模型：英文';
}
