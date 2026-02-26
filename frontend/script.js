// ========== 配置 ==========
const API_BASE_URL = 'http://localhost:8080/api';
const STATS_REFRESH_INTERVAL = 5000; // 5秒刷新一次统计数据

// ========== DOM 元素 ==========
const smsInput = document.getElementById('smsInput');
const charCount = document.getElementById('charCount');
const detectBtn = document.getElementById('detectBtn');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const historyTableBody = document.getElementById('historyTableBody');

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadStatistics();
    
    // 定期刷新统计数据
    setInterval(loadStatistics, STATS_REFRESH_INTERVAL);
});

// ========== 事件监听器 ==========
function initializeEventListeners() {
    // 检测按钮点击
    detectBtn.addEventListener('click', handleDetection);
    
    // 字符计数
    smsInput.addEventListener('input', updateCharCount);
    
    // 回车键快捷检测
    smsInput.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            handleDetection();
        }
    });
}

// ========== 短信检测功能 ==========
async function handleDetection() {
    const content = smsInput.value.trim();
    
    // 验证输入
    if (!content) {
        showError('请输入要检测的短信内容');
        return;
    }
    
    if (content.length > 500) {
        showError('短信内容不能超过500个字符');
        return;
    }
    
    // 清除之前的结果和错误
    resultContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    loadingContainer.style.display = 'block';
    detectBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/detection/detect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: content })
        });
        
        const data = await response.json();
        
        if (response.ok && data.code === 200) {
            displayResult(data.data);
            addToHistory(content, data.data);
            loadStatistics(); // 实时更新统计
        } else {
            showError(data.message || '检测失败，请稍后重试');
        }
    } catch (error) {
        console.error('检测错误:', error);
        showError('网络错误，请检查后端服务是否运行');
    } finally {
        loadingContainer.style.display = 'none';
        detectBtn.disabled = false;
    }
}

// ========== 显示检测结果 ==========
function displayResult(result) {
    // 隐藏错误提示
    errorContainer.style.display = 'none';
    
    // 显示结果容器
    resultContainer.style.display = 'block';
    
    // 更新结果标签
    const resultLabel = document.getElementById('resultLabel');
    const isSpam = result.label === 'spam';
    resultLabel.className = `result-label ${result.label}`;
    resultLabel.textContent = isSpam ? '🚫 垃圾短信' : '✅ 正常短信';
    
    // 更新详细信息
    document.getElementById('resultText').textContent = isSpam ? '垃圾短信' : '正常短信';
    document.getElementById('resultConfidence').textContent = 
        (result.confidence * 100).toFixed(2) + '%';
    document.getElementById('resultNormalProb').textContent = 
        (result.normalProbability * 100).toFixed(2) + '%';
    document.getElementById('resultSpamProb').textContent = 
        (result.spamProbability * 100).toFixed(2) + '%';
    
    // 绘制概率柱状图
    drawProbabilityChart(result.normalProbability, result.spamProbability);
}

// ========== 绘制概率柱状图 ==========
function drawProbabilityChart(normalProb, spamProb) {
    const chartElement = document.getElementById('probabilityChart');
    const myChart = echarts.init(chartElement);
    
    const option = {
        title: {
            text: '分类概率分布',
            left: 'center',
            textStyle: {
                color: '#333',
                fontSize: 14,
                fontWeight: 'bold'
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: '{b}: {c}%'
        },
        grid: {
            left: '10%',
            right: '10%',
            bottom: '10%',
            top: '30%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: ['正常短信', '垃圾短信'],
            axisLine: {
                lineStyle: {
                    color: '#ddd'
                }
            }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLine: {
                lineStyle: {
                    color: '#ddd'
                }
            }
        },
        series: [
            {
                data: [
                    (normalProb * 100).toFixed(2),
                    (spamProb * 100).toFixed(2)
                ],
                type: 'bar',
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#84fab0' },
                        { offset: 1, color: '#8fd3f4' }
                    ])
                },
                barMaxWidth: '60%'
            }
        ]
    };
    
    myChart.setOption(option);
    
    // 窗口resize时自动调整
    window.addEventListener('resize', () => {
        myChart.resize();
    });
}

// ========== 统计数据功能 ==========
async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/detection/statistics`);
        const data = await response.json();
        
        if (response.ok && data.code === 200) {
            updateStatisticsDisplay(data.data);
            drawPieChart(data.data);
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

function updateStatisticsDisplay(stats) {
    document.getElementById('totalDetections').textContent = stats.totalDetections || 0;
    document.getElementById('spamCount').textContent = stats.spamCount || 0;
    document.getElementById('normalCount').textContent = stats.normalCount || 0;
}

// ========== 绘制饼图 ==========
function drawPieChart(stats) {
    const chartElement = document.getElementById('pieChart');
    const myChart = echarts.init(chartElement);
    
    const total = stats.totalDetections || 1;
    const spamCount = stats.spamCount || 0;
    const normalCount = stats.normalCount || 0;
    
    const option = {
        title: {
            text: '垃圾/正常短信比例',
            left: 'center',
            textStyle: {
                color: '#333',
                fontSize: 14,
                fontWeight: 'bold'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: {
                color: '#666'
            }
        },
        series: [
            {
                name: '短信分类',
                type: 'pie',
                radius: '50%',
                data: [
                    {
                        value: normalCount,
                        name: '正常短信',
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: '#84fab0' },
                                { offset: 1, color: '#8fd3f4' }
                            ])
                        }
                    },
                    {
                        value: spamCount,
                        name: '垃圾短信',
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: '#fa709a' },
                                { offset: 1, color: '#fee140' }
                            ])
                        }
                    }
                ],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ]
    };
    
    myChart.setOption(option);
    
    window.addEventListener('resize', () => {
        myChart.resize();
    });
}

// ========== 历史记录功能 ==========
let detectionHistory = [];

function addToHistory(content, result) {
    const record = {
        id: detectionHistory.length + 1,
        content: content,
        result: result.label,
        confidence: result.confidence
    };
    
    detectionHistory.unshift(record); // 添加到开始
    
    // 只保留最近100条记录
    if (detectionHistory.length > 100) {
        detectionHistory = detectionHistory.slice(0, 100);
    }
    
    updateHistoryTable();
}

function updateHistoryTable() {
    if (detectionHistory.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="5" class="no-data">暂无检测记录</td></tr>';
        return;
    }
    
    historyTableBody.innerHTML = detectionHistory.map((record, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${truncateText(record.content, 50)}</td>
            <td>
                <span class="result-badge ${record.result}">
                    ${record.result === 'spam' ? '🚫 垃圾' : '✅ 正常'}
                </span>
            </td>
            <td>${(record.confidence * 100).toFixed(2)}%</td>
            <td>${new Date().toLocaleTimeString('zh-CN')}</td>
        </tr>
    `).join('');
}

// ========== 辅助函数 ==========
function updateCharCount() {
    const count = smsInput.value.length;
    charCount.textContent = count;
    
    if (count > 500) {
        smsInput.value = smsInput.value.substring(0, 500);
        charCount.textContent = '500';
    }
}

function showError(message) {
    errorContainer.style.display = 'block';
    resultContainer.style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
}

function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
}

// ========== 页面卸载时清理 ==========
window.addEventListener('beforeunload', function() {
    // 可在这里添加数据保存逻辑
    console.log('页面即将卸载');
});
