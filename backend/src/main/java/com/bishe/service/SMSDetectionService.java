package com.bishe.service;

import com.bishe.entity.SMSDetectionRecord;
import com.bishe.entity.SMSDetectionResponse;
import com.bishe.entity.StatisticsDTO;
import com.bishe.repository.SMSDetectionRecordRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 短信检测业务逻辑层（支持中英文双模型）
 * 使用 Spring RestTemplate 调用 Python ML 服务，避免 HttpClient5 兼容性问题
 */
@Slf4j
@Service
public class SMSDetectionService {

    @Autowired
    private SMSDetectionRecordRepository recordRepository;

    // RestTemplate 通过 AppConfig 注入，支持 UTF-8
    @Autowired
    private RestTemplate restTemplate;

    @Value("${ml.server.url}")
    private String mlServerUrl;

    @Value("${ml.server.predict-endpoint}")
    private String predictEndpoint;

    /**
     * 检测短信是否为垃圾短信
     *
     * @param content 短信内容
     * @param lang    语言类型: "en"（英文）或 "zh"（中文），默认 "en"
     */
    public SMSDetectionResponse detectSMS(String content, String lang) {
        if (lang == null || lang.isBlank()) {
            lang = "en";
        }
        // 异常在此直接向上抛，由 Controller 统一捕获并返回错误响应
        SMSDetectionResponse response = callMLService(content, lang);
        saveDetectionRecord(content, response, lang);
        return response;
    }

    /**
     * 调用 Python ML 服务（使用 RestTemplate）
     */
    private SMSDetectionResponse callMLService(String content, String lang) {
        String mlUrl = mlServerUrl + predictEndpoint;
        log.debug("调用 ML 服务: url={}, lang={}", mlUrl, lang);

        // 构建请求体
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("text", content);
        requestBody.put("lang", lang);

        // 设置请求头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

        // 发送请求，直接将响应映射到 Map<String, Object>
        ResponseEntity<Map<String, Object>> responseEntity = restTemplate.exchange(
                mlUrl, HttpMethod.POST, entity,
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {}
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) responseEntity.getBody();
        if (body == null) {
            throw new RuntimeException("ML 服务返回空响应");
        }

        // 检查业务状态码
        Object codeObj = body.get("code");
        int code = codeObj instanceof Number ? ((Number) codeObj).intValue() : 0;
        if (code != 200) {
            String message = (String) body.getOrDefault("message", "未知错误");
            throw new RuntimeException("ML 服务返回错误: " + message);
        }

        // 解析 data 字段
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
        result.setModelVersion((String) data.getOrDefault("model_version", "1.0.0"));
        result.setTimestamp(System.currentTimeMillis());
        result.setLang(data.containsKey("lang") ? (String) data.get("lang") : lang);

        log.debug("ML 服务返回: label={}, confidence={}", result.getLabel(), result.getConfidence());
        return result;
    }

    /** Object → double 安全转换（兼容 Integer / Double / Float 等） */
    private double toDouble(Object obj) {
        if (obj == null) return 0.0;
        if (obj instanceof Number) return ((Number) obj).doubleValue();
        try {
            return Double.parseDouble(obj.toString());
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    /**
     * 保存检测记录（含语言字段）
     */
    private void saveDetectionRecord(String content, SMSDetectionResponse response, String lang) {
        try {
            SMSDetectionRecord record = new SMSDetectionRecord();
            record.setSmsContent(content);
            record.setLabel(response.getLabel());
            record.setConfidence(response.getConfidence());
            record.setClassification("spam".equals(response.getLabel()) ? 1 : 0);
            record.setDetectionTime(LocalDateTime.now());
            record.setModelVersion(response.getModelVersion());
            record.setLang(lang);
            recordRepository.save(record);
        } catch (Exception e) {
            // 保存失败不影响返回结果，只记录日志
            log.warn("保存检测记录失败（不影响检测结果）: {}", e.getMessage());
        }
    }

    /**
     * 获取统计信息
     */
    public StatisticsDTO getStatistics() {
        Long totalCount = recordRepository.countTotal();
        Long spamCount  = recordRepository.countSpam();
        Long normalCount = recordRepository.countNormal();

        StatisticsDTO dto = new StatisticsDTO();
        dto.setTotalDetections(totalCount);
        dto.setSpamCount(spamCount);
        dto.setNormalCount(normalCount);

        if (totalCount != null && totalCount > 0) {
            dto.setSpamPercentage(Double.parseDouble(
                    String.format("%.2f", spamCount.doubleValue() / totalCount * 100)));
            dto.setNormalPercentage(Double.parseDouble(
                    String.format("%.2f", normalCount.doubleValue() / totalCount * 100)));
        } else {
            dto.setSpamPercentage(0.0);
            dto.setNormalPercentage(0.0);
        }

        return dto;
    }

    /**
     * 获取最近 N 条检测记录
     */
    public Object getRecentRecords(int limit) {
        return recordRepository.findAll()
                .stream()
                .skip(Math.max(0, recordRepository.count() - limit))
                .collect(java.util.stream.Collectors.toList());
    }
}