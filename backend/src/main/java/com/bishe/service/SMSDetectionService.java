package com.bishe.service;

import com.bishe.entity.BatchDetectionItem;
import com.bishe.entity.BatchDetectionResponse;
import com.bishe.entity.RuleEvaluationResult;
import com.bishe.entity.SMSDetectionRecord;
import com.bishe.entity.SMSDetectionResponse;
import com.bishe.entity.StatisticsDTO;
import com.bishe.repository.SMSDetectionRecordRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
public class SMSDetectionService {
    private static final int MAX_BATCH_SIZE = 10000;
    private static final DateTimeFormatter REPORT_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

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

    public SMSDetectionResponse detectSMS(String content, String lang) {
        String safeLang = normalizeLang(lang);
        SMSDetectionResponse response = detectSingle(content, safeLang);
        saveDetectionRecord(content, response, safeLang);
        return response;
    }

    public BatchDetectionResponse batchDetect(MultipartFile file, String lang) {
        String safeLang = normalizeLang(lang);
        validateFile(file);

        List<String> messages = extractMessages(file);
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
                SMSDetectionResponse result = detectSingle(content, safeLang);
                saveDetectionRecord(content, result, safeLang);
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

    public StatisticsDTO getStatistics() {
        long totalCount = safeCount(recordRepository.countTotal());
        long spamCount = safeCount(recordRepository.countSpam());
        long suspiciousCount = safeCount(recordRepository.countSuspicious());
        long normalCount = safeCount(recordRepository.countNormal());

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

    public Object getRecentRecords(int limit) {
        return recordRepository.findAll()
                .stream()
                .skip(Math.max(0, recordRepository.count() - limit))
                .collect(Collectors.toList());
    }

    private SMSDetectionResponse detectSingle(String content, String lang) {
        SMSDetectionResponse modelResult = callMLService(content, lang);
        return applyFusionDecision(content, modelResult);
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
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {}
        );

        @SuppressWarnings("unchecked")
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

    private SMSDetectionResponse applyFusionDecision(String content, SMSDetectionResponse modelResult) {
        RuleEvaluationResult fusionResult = keywordRuleService.evaluate(content, modelResult.getSpamProbability());

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

    private void saveDetectionRecord(String content, SMSDetectionResponse response, String lang) {
        try {
            SMSDetectionRecord record = new SMSDetectionRecord();
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
        item.setMatchedStrongWhitelistKeywords(result.getMatchedStrongWhitelistKeywords());
        item.setMatchedStrongBlacklistKeywords(result.getMatchedStrongBlacklistKeywords());
        item.setMatchedWeakWhitelistKeywords(result.getMatchedWeakWhitelistKeywords());
        item.setMatchedWeakBlacklistKeywords(result.getMatchedWeakBlacklistKeywords());
    }

    private void validateFile(MultipartFile file) {
        String fileName = Objects.requireNonNullElse(file.getOriginalFilename(), "").toLowerCase();
        if (!(fileName.endsWith(".csv") || fileName.endsWith(".txt"))) {
            throw new IllegalArgumentException("仅支持上传 .csv 或 .txt 文件");
        }
    }

    private List<String> extractMessages(MultipartFile file) {
        String fileName = Objects.requireNonNullElse(file.getOriginalFilename(), "").toLowerCase();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            if (fileName.endsWith(".txt")) {
                return reader.lines()
                        .map(this::stripBom)
                        .map(String::trim)
                        .filter(line -> !line.isEmpty())
                        .collect(Collectors.toList());
            }

            List<String> rows = reader.lines().collect(Collectors.toList());
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
                    .append(csvEscape(item.getDecisionSource())).append(',')
                    .append(csvEscape(item.getRuleNote())).append(',')
                    .append(csvEscape(item.getError() == null ? "成功" : "失败: " + item.getError()))
                    .append('\n');
        }
        return builder.toString();
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
}
