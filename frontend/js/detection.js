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
            body: JSON.stringify({ content, lang: currentLang, userId: getCurrentUserId() })
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
        loadDetectionTrend();
        loadKeywordInsights();
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
    resultRiskScore.textContent = `风险评分 ${Math.round(Number(result.riskScore || 0))}`;
    resultExplanationSummary.textContent = result.explanationSummary || result.ruleNote || '-';
    renderExplanationKeywords(result.matchedKeywords || []);
    renderExplanationItems(result.explanationItems || []);

    drawProbabilityChart(result);
}

function renderExplanationKeywords(keywords) {
    if (!keywords.length) {
        resultKeywordChips.innerHTML = '<span class="muted">暂无命中关键词</span>';
        return;
    }
    resultKeywordChips.innerHTML = keywords.map((keyword) => `
        <span class="result-keyword-chip">${escapeHtml(keyword)}</span>
    `).join('');
}

function renderExplanationItems(items) {
    if (!items.length) {
        resultExplanationList.innerHTML = '<div class="muted">暂无详细判定说明</div>';
        return;
    }
    resultExplanationList.innerHTML = items.map((item) => `
        <div class="explanation-item">
            <strong>${escapeHtml(item.title || '-')}</strong>
            <p>${escapeHtml(item.detail || '-')}</p>
        </div>
    `).join('');
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
    if (getCurrentUserId()) {
        formData.append('userId', String(getCurrentUserId()));
    }

    batchLoadingContainer.style.display = 'block';
    batchResultContainer.style.display = 'none';
    batchTaskStatusCard.style.display = 'none';
    batchDetectBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/detection/batch-detect/tasks`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (!response.ok || data.code !== 200) {
            throw new Error(data.message || '批量任务创建失败');
        }

        currentBatchTaskId = data.data.taskId;
        renderBatchTaskStatus(data.data);
        showToast('批量任务已创建，系统正在后台处理');
        pollBatchTask(currentBatchTaskId);
    } catch (error) {
        showBatchError(`批量检测失败：${error.message}`);
        batchLoadingContainer.style.display = 'none';
        batchDetectBtn.disabled = false;
        healthPill.textContent = '系统状态：后端不可达';
    }
}

function pollBatchTask(taskId) {
    if (batchTaskTimer) {
        clearInterval(batchTaskTimer);
    }

    const run = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/detection/batch-detect/tasks/${taskId}`);
            const data = await response.json();
            if (!response.ok || data.code !== 200) {
                throw new Error(data.message || '获取批量任务失败');
            }

            renderBatchTaskStatus(data.data);

            if (data.data.status === 'completed') {
                if (batchTaskTimer) {
                    clearInterval(batchTaskTimer);
                    batchTaskTimer = null;
                }
                batchLoadingContainer.style.display = 'none';
                batchDetectBtn.disabled = false;
                lastBatchResult = data.data;
                displayBatchResult(data.data);
                mergeBatchResultsToHistory(data.data.items || []);
                renderHistoryTable();
                loadStatistics();
                loadDetectionTrend();
                loadKeywordInsights();
                healthPill.textContent = '系统状态：在线';
                return;
            }

            if (data.data.status === 'failed') {
                if (batchTaskTimer) {
                    clearInterval(batchTaskTimer);
                    batchTaskTimer = null;
                }
                batchLoadingContainer.style.display = 'none';
                batchDetectBtn.disabled = false;
                showBatchError(`批量任务失败：${data.data.errorMessage || '未知错误'}`);
            }
        } catch (error) {
            if (batchTaskTimer) {
                clearInterval(batchTaskTimer);
                batchTaskTimer = null;
            }
            batchLoadingContainer.style.display = 'none';
            batchDetectBtn.disabled = false;
            showBatchError(`获取批量任务失败：${error.message}`);
        }
    };

    run();
    batchTaskTimer = setInterval(run, 2000);
}

function renderBatchTaskStatus(task) {
    batchTaskStatusCard.style.display = 'block';
    batchTaskId.textContent = task.taskId || '-';
    batchTaskFileName.textContent = task.fileName || '-';
    batchTaskProcessed.textContent = task.totalCount ? `${task.processedCount || 0} / ${task.totalCount}` : '准备中';

    const mapping = {
        pending: '等待执行',
        processing: '后台处理中',
        completed: '已完成',
        failed: '已失败'
    };
    const text = mapping[task.status] || task.status || '-';
    batchTaskStatusText.textContent = text;
    batchTaskPhase.textContent = text;
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
            <td>${item.lang === 'zh' ? '中文模型' : '英文模型'}</td>
            <td>${item.error
                ? `<span class="batch-status fail">${escapeHtml(item.error)}</span>`
                : `<span class="batch-status ${statusClass(item.label)}">${escapeHtml(item.explanationSummary || formatDecisionSource(item.decisionSource))}</span>`}</td>
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

    downloadBase64File(
        lastBatchResult.reportBase64,
        lastBatchResult.reportFileName || `batch-detection-report-${Date.now()}.csv`,
        'text/csv;charset=utf-8;'
    );
}

async function loadStatistics() {
    if (!getCurrentUserId()) {
        totalDetections.textContent = '0';
        spamCount.textContent = '0';
        suspiciousCount.textContent = '0';
        normalCount.textContent = '0';
        drawPieChart({ normalCount: 0, suspiciousCount: 0, spamCount: 0 });
        return;
    }

    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/statistics`));
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

async function loadDetectionTrend() {
    if (!getCurrentUserId()) {
        lastTrendPoints = [];
        drawTrendChart([]);
        return;
    }

    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/statistics/trend?days=7`));
        const data = await response.json();
        if (response.ok && data.code === 200) {
            lastTrendPoints = data.data || [];
            drawTrendChart(lastTrendPoints);
        }
    } catch {
        lastTrendPoints = [];
        drawTrendChart([]);
    }
}

async function loadKeywordInsights() {
    if (!getCurrentUserId()) {
        lastKeywordInsights = [];
        drawKeywordInsightChart([]);
        renderKeywordInsights([]);
        return;
    }

    try {
        const response = await fetch(withUserQuery(`${API_BASE_URL}/detection/statistics/keyword-insights?limit=8`));
        const data = await response.json();
        if (response.ok && data.code === 200) {
            lastKeywordInsights = data.data || [];
            drawKeywordInsightChart(lastKeywordInsights);
            renderKeywordInsights(lastKeywordInsights);
        }
    } catch {
        lastKeywordInsights = [];
        drawKeywordInsightChart([]);
        renderKeywordInsights([]);
    }
}

function drawProbabilityChart(result) {
    if (!window.echarts) {
        return;
    }

    probabilityChart = probabilityChart || echarts.init(document.getElementById('probabilityChart'));
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

function drawTrendChart(points) {
    if (!window.echarts || !trendChartEl) {
        return;
    }

    trendChart = trendChart || echarts.init(trendChartEl);
    const axisColor = isDarkTheme() ? '#6d7481' : '#9aa4b2';
    const splitColor = isDarkTheme() ? '#2f3542' : '#edf0f5';
    const titleColor = isDarkTheme() ? '#e8ecf2' : '#1d2129';

    trendChart.setOption({
        backgroundColor: 'transparent',
        title: {
            text: '近 7 天检测趋势',
            left: 'center',
            textStyle: { color: titleColor, fontSize: 14 }
        },
        tooltip: { trigger: 'axis' },
        legend: {
            top: 28,
            textStyle: { color: titleColor }
        },
        grid: { left: 40, right: 20, top: 70, bottom: 30 },
        xAxis: {
            type: 'category',
            data: points.map((item) => item.date),
            axisLine: { lineStyle: { color: axisColor } }
        },
        yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: axisColor } },
            splitLine: { lineStyle: { color: splitColor } }
        },
        series: [
            {
                name: '总检测量',
                type: 'line',
                smooth: true,
                data: points.map((item) => item.totalCount || 0),
                lineStyle: { color: '#165dff' },
                itemStyle: { color: '#165dff' },
                areaStyle: { color: 'rgba(22,93,255,0.12)' }
            },
            {
                name: '垃圾短信',
                type: 'line',
                smooth: true,
                data: points.map((item) => item.spamCount || 0),
                lineStyle: { color: '#ff7d7f' },
                itemStyle: { color: '#ff7d7f' }
            },
            {
                name: '可疑短信',
                type: 'line',
                smooth: true,
                data: points.map((item) => item.suspiciousCount || 0),
                lineStyle: { color: '#f5c86a' },
                itemStyle: { color: '#f5c86a' }
            }
        ]
    });
}

function drawKeywordInsightChart(items) {
    if (!window.echarts || !keywordInsightChartEl) {
        return;
    }

    keywordInsightChart = keywordInsightChart || echarts.init(keywordInsightChartEl);
    const axisColor = isDarkTheme() ? '#6d7481' : '#9aa4b2';
    const splitColor = isDarkTheme() ? '#2f3542' : '#edf0f5';
    const titleColor = isDarkTheme() ? '#e8ecf2' : '#1d2129';

    keywordInsightChart.setOption({
        backgroundColor: 'transparent',
        title: {
            text: '高频命中关键词',
            left: 'center',
            textStyle: { color: titleColor, fontSize: 14 }
        },
        tooltip: { trigger: 'axis' },
        grid: { left: 50, right: 10, top: 50, bottom: 60 },
        xAxis: {
            type: 'category',
            data: items.map((item) => item.keyword),
            axisLine: { lineStyle: { color: axisColor } },
            axisLabel: { interval: 0, rotate: 30 }
        },
        yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: axisColor } },
            splitLine: { lineStyle: { color: splitColor } }
        },
        series: [{
            type: 'bar',
            data: items.map((item) => item.hitCount || 0),
            barMaxWidth: 42,
            itemStyle: { color: '#0fc6c2' }
        }]
    });
}

function renderKeywordInsights(items) {
    if (!items.length) {
        keywordInsightList.innerHTML = '<div class="muted">近 30 天暂无关键词命中统计</div>';
        return;
    }

    keywordInsightList.innerHTML = items.map((item) => `
        <div class="keyword-insight-item">
            <div class="keyword-insight-meta">
                <strong>${escapeHtml(item.keyword)}</strong>
                <small>${escapeHtml(item.category)}</small>
            </div>
            <span class="keyword-insight-chip">命中 ${item.hitCount || 0} 次</span>
        </div>
    `).join('');
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
