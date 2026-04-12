document.addEventListener('DOMContentLoaded', () => {
    restoreCurrentUser();
    if (!requireAuth()) {
        return;
    }

    initializeTheme();
    initializeAuth();
    initializeNavigation();
    initializeEventListeners();
    updateLanguageUI();
    updateBatchLanguageUI();
    window.addEventListener('resize', resizeCharts);

    loadSavedData();
    renderTemplateTable();
    renderHistoryTable();
    renderKeywordLists();
    renderFeedbackTable();
    renderBatchTable([]);
    loadStatistics();
    loadDetectionTrend();
    loadKeywordInsights();
    loadRecentRecords();
    loadKeywordRules();
    loadFeedbackSamples();
    loadKeywordStats();

    if (!statsTimer) {
        statsTimer = setInterval(loadStatistics, STATS_REFRESH_INTERVAL);
    }
});
