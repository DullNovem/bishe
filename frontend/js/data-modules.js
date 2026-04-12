async function loadRecentRecords() {
    if (!getCurrentUserId()) {
        detectionHistory = detectionHistory.filter((item) => item.source !== 'backend');
        renderHistoryTable();
        return;
    }
    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/recent-records?limit=100`));
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
    if (!getCurrentUserId()) {
        keywordRules = normalizeKeywordRules({});
        renderKeywordLists();
        return;
    }
    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/keyword-rules`));
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
    if (!getCurrentUserId()) {
        showBatchError('请先登录后再设置个人黑白名单');
        return;
    }
    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/keyword-rules`), {
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
    if (!getCurrentUserId()) {
        feedbackSamples = [];
        renderFeedbackTable();
        submittedFeedbackKeys = new Set();
        return;
    }
    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/feedback`));
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
    if (!getCurrentUserId()) {
        keywordStats = [];
        renderKeywordStatsTable();
        return;
    }
    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/feedback/keyword-stats`));
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
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/feedback/export`));
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
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/feedback/generate-training-dataset`), {
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
        body: JSON.stringify({ ...payload, userId: getCurrentUserId() })
    });
    const data = await response.json();
    if (!response.ok || data.code !== 200) {
        throw new Error(data.message || '提交失败');
    }
    return data.data;
}

async function updateFeedbackStatus(id, status) {
    const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/feedback/${id}/status`), {
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
    const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/feedback/${id}`), {
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

