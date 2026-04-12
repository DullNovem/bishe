package com.bishe.service;

import com.bishe.entity.BatchDetectionItem;
import com.bishe.entity.BatchDetectionResponse;
import com.bishe.entity.DetectionExplanationItem;
import com.bishe.entity.DetectionTrendPointDTO;
import com.bishe.entity.KeywordInsightDTO;
import com.bishe.entity.RuleEvaluationResult;
import com.bishe.entity.SMSDetectionRecord;
import com.bishe.entity.SMSDetectionResponse;
import com.bishe.entity.StatisticsDTO;
import com.bishe.repository.SMSDetectionRecordRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
public class SMSDetectionService {
    private static final int MAX_BATCH_SIZE = 10000;
    private static final DateTimeFormatter REPORT_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
    private static final DateTimeFormatter TREND_DATE_FORMAT = DateTimeFormatter.ofPattern("MM-dd");

    @Autowired
    private SMSDetectionRecordRepository recordRepository;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private KeywordRuleService keywordRuleService;

    @Value("${ml.server.url}")
    private String mlServerUrl;

    @Value("${ml.server.predict-endpoint}")
    private String predictEndpoint;

    public SMSDetectionResponse detectSMS(String content, String lang, Long userId) {
        String safeLang = normalizeLang(lang);
        SMSDetectionResponse response = detectSingle(content, safeLang, userId);
        saveDetectionRecord(content, response, safeLang, userId);
        return response;
    }

    public BatchDetectionResponse batchDetect(MultipartFile file, String lang, Long userId) {
        String safeLang = normalizeLang(lang);
        validateFile(Objects.requireNonNullElse(file.getOriginalFilename(), "").toLowerCase());
        try {
            return batchDetect(file.getOriginalFilename(), file.getBytes(), safeLang, userId);
        } catch (IOException e) {
            throw new IllegalArgumentException("读取上传文件失败");
        }
    }

    public BatchDetectionResponse batchDetect(String fileName, byte[] fileBytes, String lang, Long userId) {
        String safeLang = normalizeLang(lang);
        validateFile(Objects.requireNonNullElse(fileName, "").toLowerCase());
        List<String> messages = extractMessages(fileName, fileBytes);
        return processBatchMessages(messages, safeLang, userId);
    }

    public StatisticsDTO getStatistics(Long userId) {
        long totalCount = safeCount(recordRepository.countTotal(userId));
        long spamCount = safeCount(recordRepository.countSpam(userId));
        long suspiciousCount = safeCount(recordRepository.countSuspicious(userId));
        long normalCount = safeCount(recordRepository.countNormal(userId));

        StatisticsDTO dto = new StatisticsDTO();
        dto.setTotalDetections(totalCount);
        dto.setSpamCount(spamCount);
        dto.setSuspiciousCount(suspiciousCount);
        dto.setNormalCount(normalCount);

        if (totalCount > 0) {
            dto.setSpamPercentage(roundPercentage(spamCount, totalCount));
            dto.setSuspiciousPercentage(roundPercentage(suspiciousCount, totalCount));
            dto.setNormalPercentage(roundPercentage(normalCount, totalCount));
        } else {
            dto.setSpamPercentage(0.0);
            dto.setSuspiciousPercentage(0.0);
            dto.setNormalPercentage(0.0);
        }
        return dto;
    }

    public List<DetectionTrendPointDTO> getDetectionTrend(Long userId, int days) {
        int safeDays = Math.max(1, Math.min(days, 30));
        LocalDate startDate = LocalDate.now().minusDays(safeDays - 1L);
        LocalDateTime startTime = startDate.atStartOfDay();

        List<SMSDetectionRecord> records = userId == null
                ? recordRepository.findAllByDetectionTimeAfterOrderByDetectionTimeAsc(startTime)
                : recordRepository.findAllByUserIdAndDetectionTimeAfterOrderByDetectionTimeAsc(userId, startTime);

        Map<LocalDate, List<SMSDetectionRecord>> grouped = records.stream()
                .collect(Collectors.groupingBy(record -> record.getDetectionTime().toLocalDate(), LinkedHashMap::new, Collectors.toList()));

        List<DetectionTrendPointDTO> points = new ArrayList<>();
        for (int i = 0; i < safeDays; i++) {
            LocalDate current = startDate.plusDays(i);
            List<SMSDetectionRecord> dayRecords = grouped.getOrDefault(current, List.of());

            long spam = dayRecords.stream().filter(record -> record.getClassification() != null && record.getClassification() == 1).count();
            long suspicious = dayRecords.stream().filter(record -> record.getClassification() != null && record.getClassification() == 2).count();
            long normal = dayRecords.stream().filter(record -> record.getClassification() == null || record.getClassification() == 0).count();

            points.add(new DetectionTrendPointDTO(
                    current.format(TREND_DATE_FORMAT),
                    (long) dayRecords.size(),
                    spam,
                    suspicious,
                    normal
            ));
        }
        return points;
    }

    public List<KeywordInsightDTO> getKeywordInsights(Long userId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        LocalDateTime startTime = LocalDate.now().minusDays(29).atStartOfDay();

        List<SMSDetectionRecord> records = userId == null
                ? recordRepository.findAllByDetectionTimeAfterOrderByDetectionTimeAsc(startTime)
                : recordRepository.findAllByUserIdAndDetectionTimeAfterOrderByDetectionTimeAsc(userId, startTime);

        List<SMSDetectionRecord> riskyRecords = records.stream()
                .filter(record -> record.getClassification() != null && record.getClassification() != 0)
                .toList();

        Map<String, Long> hits = new HashMap<>();
        var mergedConfig = keywordRuleService.getMergedConfig(userId);
        mergedConfig.getStrongBlacklistKeywords().forEach(keyword -> hits.put("强黑名单::" + keyword, countKeywordHits(riskyRecords, keyword)));
        mergedConfig.getWeakBlacklistKeywords().forEach(keyword -> hits.put("弱黑名单::" + keyword, countKeywordHits(riskyRecords, keyword)));
        mergedConfig.getStrongWhitelistKeywords().forEach(keyword -> hits.put("强白名单::" + keyword, countKeywordHits(riskyRecords, keyword)));
        mergedConfig.getWeakWhitelistKeywords().forEach(keyword -> hits.put("弱白名单::" + keyword, countKeywordHits(riskyRecords, keyword)));

        return hits.entrySet().stream()
                .filter(entry -> entry.getValue() > 0)
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(safeLimit)
                .map(entry -> {
                    String[] parts = entry.getKey().split("::", 2);
                    return new KeywordInsightDTO(parts[1], parts[0], entry.getValue());
                })
                .collect(Collectors.toList());
    }

    public Object getRecentRecords(int limit, Long userId) {
        List<SMSDetectionRecord> records = userId == null
                ? recordRepository.findTop100ByOrderByDetectionTimeDesc()
                : recordRepository.findTop100ByUserIdOrderByDetectionTimeDesc(userId);
        return records.stream()
                .limit(Math.max(limit, 0))
                .collect(Collectors.toList());
    }

    private BatchDetectionResponse processBatchMessages(List<String> messages, String safeLang, Long userId) {
        if (messages.isEmpty()) {
            throw new IllegalArgumentException("文件中未读取到有效短信内容");
        }
        if (messages.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("单次批量检测最多支持 10000 条短信");
        }

        List<BatchDetectionItem> items = new ArrayList<>();
        int spamCount = 0;
        int suspiciousCount = 0;
        int normalCount = 0;
        int failedCount = 0;

        for (int i = 0; i < messages.size(); i++) {
            String content = messages.get(i);
            BatchDetectionItem item = new BatchDetectionItem();
            item.setRowNo(i + 1);
            item.setContent(content);

            try {
                SMSDetectionResponse result = detectSingle(content, safeLang, userId);
                saveDetectionRecord(content, result, safeLang, userId);
                copyDetectionResult(item, result);

                switch (result.getLabel()) {
                    case "spam" -> spamCount++;
                    case "suspicious" -> suspiciousCount++;
                    default -> normalCount++;
                }
            } catch (Exception e) {
                failedCount++;
                item.setError(e.getMessage());
                item.setLang(safeLang);
                log.warn("批量检测第 {} 条失败: {}", i + 1, e.getMessage());
            }

            items.add(item);
        }

        BatchDetectionResponse response = new BatchDetectionResponse();
        response.setTotalCount(messages.size());
        response.setSuccessCount(messages.size() - failedCount);
        response.setFailedCount(failedCount);
        response.setSpamCount(spamCount);
        response.setSuspiciousCount(suspiciousCount);
        response.setNormalCount(normalCount);
        response.setItems(items);

        String reportFileName = "batch-detection-report-" + LocalDateTime.now().format(REPORT_TIME_FORMAT) + ".csv";
        response.setReportFileName(reportFileName);
        response.setReportBase64(Base64.getEncoder().encodeToString(buildCsvReport(items).getBytes(StandardCharsets.UTF_8)));
        return response;
    }

    private SMSDetectionResponse detectSingle(String content, String lang, Long userId) {
        SMSDetectionResponse modelResult = callMLService(content, lang);
        SMSDetectionResponse response = applyFusionDecision(content, modelResult, userId);
        enrichExplanation(response);
        return response;
    }

    private SMSDetectionResponse callMLService(String content, String lang) {
        String mlUrl = mlServerUrl + predictEndpoint;

        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("text", content);
        requestBody.put("lang", lang);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map<String, Object>> responseEntity = restTemplate.exchange(
                mlUrl,
                HttpMethod.POST,
                entity,
                new ParameterizedTypeReference<>() {}
        );

        Map<String, Object> body = responseEntity.getBody();
        if (body == null) {
            throw new RuntimeException("ML 服务返回空响应");
        }

        Object codeObj = body.get("code");
        int code = codeObj instanceof Number ? ((Number) codeObj).intValue() : 0;
        if (code != 200) {
            String message = String.valueOf(body.getOrDefault("message", "未知错误"));
            throw new RuntimeException("ML 服务返回错误: " + message);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) body.get("data");
        if (data == null) {
            throw new RuntimeException("ML 服务响应中缺少 data 字段");
        }

        SMSDetectionResponse result = new SMSDetectionResponse();
        result.setLabel((String) data.get("label"));
        result.setConfidence(toDouble(data.get("confidence")));
        result.setNormalProbability(toDouble(data.get("normal_prob")));
        result.setSpamProbability(toDouble(data.get("spam_prob")));
        result.setSuspiciousProbability(0.0);
        result.setModelVersion((String) data.getOrDefault("model_version", "1.0.0"));
        result.setTimestamp(System.currentTimeMillis());
        result.setLang(data.containsKey("lang") ? (String) data.get("lang") : lang);
        result.setDecisionSource("model");
        result.setRuleNote("使用模型原始结果");
        result.setRiskScore(result.getSpamProbability() * 100);
        return result;
    }

    private SMSDetectionResponse applyFusionDecision(String content, SMSDetectionResponse modelResult, Long userId) {
        RuleEvaluationResult fusionResult = keywordRuleService.evaluate(content, modelResult.getSpamProbability(), userId);

        modelResult.setLabel(fusionResult.getFinalLabel());
        modelResult.setDecisionSource(fusionResult.getDecisionSource());
        modelResult.setRuleNote(fusionResult.getRuleNote());
        modelResult.setRiskScore(fusionResult.getRiskScore());
        modelResult.setMatchedStrongWhitelistKeywords(fusionResult.getMatchedStrongWhitelistKeywords());
        modelResult.setMatchedStrongBlacklistKeywords(fusionResult.getMatchedStrongBlacklistKeywords());
        modelResult.setMatchedWeakWhitelistKeywords(fusionResult.getMatchedWeakWhitelistKeywords());
        modelResult.setMatchedWeakBlacklistKeywords(fusionResult.getMatchedWeakBlacklistKeywords());

        if ("spam".equals(fusionResult.getFinalLabel())) {
            modelResult.setSuspiciousProbability(0.05);
            if ("rule:strong-blacklist".equals(fusionResult.getDecisionSource())) {
                modelResult.setNormalProbability(0.01);
                modelResult.setSpamProbability(0.99);
                modelResult.setConfidence(0.99);
            } else {
                modelResult.setConfidence(Math.max(modelResult.getSpamProbability(), fusionResult.getRiskScore() / 100));
            }
        } else if ("suspicious".equals(fusionResult.getFinalLabel())) {
            modelResult.setSuspiciousProbability(Math.max(0.55, fusionResult.getRiskScore() / 100));
            modelResult.setConfidence(modelResult.getSuspiciousProbability());
        } else {
            modelResult.setSuspiciousProbability(0.05);
            if ("rule:strong-whitelist".equals(fusionResult.getDecisionSource())) {
                modelResult.setNormalProbability(0.99);
                modelResult.setSpamProbability(0.01);
                modelResult.setConfidence(0.99);
            } else {
                modelResult.setConfidence(Math.max(modelResult.getNormalProbability(), 1 - fusionResult.getRiskScore() / 100));
            }
        }

        return modelResult;
    }

    private void saveDetectionRecord(String content, SMSDetectionResponse response, String lang, Long userId) {
        try {
            SMSDetectionRecord record = new SMSDetectionRecord();
            record.setUserId(userId);
            record.setSmsContent(content);
            record.setLabel(response.getLabel());
            record.setConfidence(response.getConfidence());
            record.setClassification(toClassification(response.getLabel()));
            record.setDetectionTime(LocalDateTime.now());
            record.setModelVersion(response.getModelVersion());
            record.setLang(lang);
            recordRepository.save(record);
        } catch (Exception e) {
            log.warn("保存检测记录失败: {}", e.getMessage());
        }
    }

    private void copyDetectionResult(BatchDetectionItem item, SMSDetectionResponse result) {
        item.setLabel(result.getLabel());
        item.setConfidence(result.getConfidence());
        item.setNormalProbability(result.getNormalProbability());
        item.setSuspiciousProbability(result.getSuspiciousProbability());
        item.setSpamProbability(result.getSpamProbability());
        item.setLang(result.getLang());
        item.setDecisionSource(result.getDecisionSource());
        item.setRuleNote(result.getRuleNote());
        item.setRiskScore(result.getRiskScore());
        item.setExplanationSummary(result.getExplanationSummary());
        item.setMatchedKeywords(result.getMatchedKeywords());
        item.setExplanationItems(result.getExplanationItems());
        item.setMatchedStrongWhitelistKeywords(result.getMatchedStrongWhitelistKeywords());
        item.setMatchedStrongBlacklistKeywords(result.getMatchedStrongBlacklistKeywords());
        item.setMatchedWeakWhitelistKeywords(result.getMatchedWeakWhitelistKeywords());
        item.setMatchedWeakBlacklistKeywords(result.getMatchedWeakBlacklistKeywords());
    }

    private void validateFile(String fileName) {
        if (!(fileName.endsWith(".csv") || fileName.endsWith(".txt"))) {
            throw new IllegalArgumentException("仅支持上传 .csv 或 .txt 文件");
        }
    }

    private List<String> extractMessages(String fileName, byte[] fileBytes) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new ByteArrayInputStream(fileBytes), StandardCharsets.UTF_8))) {
            if (fileName.endsWith(".txt")) {
                return reader.lines()
                        .map(this::stripBom)
                        .map(String::trim)
                        .filter(line -> !line.isEmpty())
                        .collect(Collectors.toList());
            }

            List<String> rows = reader.lines().toList();
            List<String> messages = new ArrayList<>();
            for (int i = 0; i < rows.size(); i++) {
                String line = stripBom(rows.get(i)).trim();
                if (line.isEmpty()) {
                    continue;
                }

                String message = parseCsvMessage(line);
                if (i == 0 && isHeaderRow(message)) {
                    continue;
                }
                if (!message.isBlank()) {
                    messages.add(message);
                }
            }
            return messages;
        } catch (IOException e) {
            throw new IllegalArgumentException("读取上传文件失败");
        }
    }

    private String stripBom(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return value.charAt(0) == '\uFEFF' ? value.substring(1) : value;
    }

    private String parseCsvMessage(String line) {
        String value = line.trim();
        if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
            return value.substring(1, value.length() - 1).replace("\"\"", "\"").trim();
        }

        int commaIndex = value.indexOf(',');
        if (commaIndex >= 0) {
            value = value.substring(0, commaIndex);
        }
        return value.replace("\"", "").trim();
    }

    private boolean isHeaderRow(String value) {
        String lowered = value.trim().toLowerCase();
        return lowered.equals("content")
                || lowered.equals("sms")
                || lowered.equals("text")
                || lowered.equals("message")
                || lowered.equals("短信内容");
    }

    private String buildCsvReport(List<BatchDetectionItem> items) {
        StringBuilder builder = new StringBuilder();
        builder.append('\uFEFF');
        builder.append("序号,短信内容,检测结果,风险分,置信度,正常概率,可疑概率,垃圾概率,模型,判定来源,规则说明,状态\n");
        for (BatchDetectionItem item : items) {
            builder.append(item.getRowNo()).append(',')
                    .append(csvEscape(item.getContent())).append(',')
                    .append(csvEscape(formatLabel(item.getLabel()))).append(',')
                    .append(csvEscape(formatNumber(item.getRiskScore()))).append(',')
                    .append(csvEscape(formatPercentage(item.getConfidence()))).append(',')
                    .append(csvEscape(formatPercentage(item.getNormalProbability()))).append(',')
                    .append(csvEscape(formatPercentage(item.getSuspiciousProbability()))).append(',')
                    .append(csvEscape(formatPercentage(item.getSpamProbability()))).append(',')
                    .append(csvEscape("zh".equals(item.getLang()) ? "中文" : "英文")).append(',')
                    .append(csvEscape(formatDecisionSource(item.getDecisionSource()))).append(',')
                    .append(csvEscape(item.getRuleNote())).append(',')
                    .append(csvEscape(item.getError() == null ? "成功" : "失败: " + item.getError()))
                    .append('\n');
        }
        return builder.toString();
    }

    private void enrichExplanation(SMSDetectionResponse result) {
        List<String> matchedKeywords = new ArrayList<>();
        matchedKeywords.addAll(result.getMatchedStrongWhitelistKeywords());
        matchedKeywords.addAll(result.getMatchedStrongBlacklistKeywords());
        matchedKeywords.addAll(result.getMatchedWeakWhitelistKeywords());
        matchedKeywords.addAll(result.getMatchedWeakBlacklistKeywords());

        List<String> deduped = matchedKeywords.stream().distinct().collect(Collectors.toList());
        result.setMatchedKeywords(deduped);
        result.setExplanationSummary(buildExplanationSummary(result));

        List<DetectionExplanationItem> explanationItems = new ArrayList<>();
        explanationItems.add(new DetectionExplanationItem("判定依据", formatDecisionSource(result.getDecisionSource()), "decision"));
        explanationItems.add(new DetectionExplanationItem("风险解释", result.getRuleNote(), "reason"));
        explanationItems.add(new DetectionExplanationItem(
                "风险评分",
                String.format("%.0f / 100，模型垃圾概率 %.2f%%",
                        result.getRiskScore() == null ? 0.0 : result.getRiskScore(),
                        (result.getSpamProbability() == null ? 0.0 : result.getSpamProbability() * 100)),
                "score"
        ));
        explanationItems.add(new DetectionExplanationItem(
                "命中关键词",
                deduped.isEmpty()
                        ? "未命中显式黑白名单关键词，主要依据模型概率和文本模式特征判定"
                        : String.join("、", deduped),
                "keyword"
        ));
        result.setExplanationItems(explanationItems);
    }

    private String buildExplanationSummary(SMSDetectionResponse result) {
        if ("spam".equals(result.getLabel())) {
            return result.getMatchedKeywords().isEmpty()
                    ? "当前短信整体风险较高，系统判定为垃圾短信。"
                    : "当前短信命中高风险特征与关键词，系统判定为垃圾短信。";
        }
        if ("suspicious".equals(result.getLabel())) {
            return "当前短信存在一定风险信号，但未达到直接判定垃圾短信的阈值，因此进入可疑短信。";
        }
        return result.getMatchedKeywords().isEmpty()
                ? "当前短信未发现明显高风险信号，系统判定为正常短信。"
                : "当前短信命中安全或低风险信号，系统判定为正常短信。";
    }

    private String formatDecisionSource(String source) {
        return switch (source) {
            case "rule:strong-whitelist" -> "强白名单直判";
            case "rule:strong-blacklist" -> "强黑名单直判";
            case "fusion:rule-conflict" -> "模型与规则冲突";
            case "fusion:low-confidence" -> "模型低置信度回退";
            case "fusion:safe-pattern" -> "安全通知模式";
            case "fusion:composite-high-risk" -> "高风险组合特征";
            case "fusion:high-risk" -> "模型与规则高风险融合";
            case "fusion:medium-risk" -> "模型与规则中风险融合";
            case "fusion:low-risk" -> "模型与规则低风险融合";
            default -> source == null ? "-" : source;
        };
    }

    private String normalizeLang(String lang) {
        return (lang == null || lang.isBlank()) ? "en" : lang;
    }

    private long safeCount(Long value) {
        return value == null ? 0L : value;
    }

    private double roundPercentage(long count, long total) {
        return Double.parseDouble(String.format("%.2f", count * 100.0 / total));
    }

    private int toClassification(String label) {
        return switch (label) {
            case "spam" -> 1;
            case "suspicious" -> 2;
            default -> 0;
        };
    }

    private double toDouble(Object obj) {
        if (obj == null) {
            return 0.0;
        }
        if (obj instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(obj.toString());
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    private String formatLabel(String label) {
        return switch (label) {
            case "spam" -> "垃圾短信";
            case "suspicious" -> "可疑短信";
            default -> "正常短信";
        };
    }

    private String formatPercentage(Double value) {
        if (value == null) {
            return "";
        }
        return String.format("%.2f%%", value * 100);
    }

    private String formatNumber(Double value) {
        if (value == null) {
            return "";
        }
        return String.format("%.0f", value);
    }

    private String csvEscape(String value) {
        String safeValue = value == null ? "" : value;
        if (safeValue.contains(",") || safeValue.contains("\"") || safeValue.contains("\n")) {
            return "\"" + safeValue.replace("\"", "\"\"") + "\"";
        }
        return safeValue;
    }

    private long countKeywordHits(List<SMSDetectionRecord> records, String keyword) {
        String loweredKeyword = keyword.toLowerCase();
        return records.stream()
                .map(SMSDetectionRecord::getSmsContent)
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .filter(content -> content.contains(loweredKeyword))
                .count();
    }
}
