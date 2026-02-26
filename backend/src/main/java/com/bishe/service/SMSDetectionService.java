package com.bishe.service;

import com.bishe.entity.SMSDetectionRecord;
import com.bishe.entity.SMSDetectionResponse;
import com.bishe.entity.StatisticsDTO;
import com.bishe.repository.SMSDetectionRecordRepository;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;

/**
 * 短信检测业务逻辑层
 */
@Slf4j
@Service
public class SMSDetectionService {

    @Autowired
    private SMSDetectionRecordRepository recordRepository;

    @Value("${ml.server.url}")
    private String mlServerUrl;

    @Value("${ml.server.predict-endpoint}")
    private String predictEndpoint;

    /**
     * 检测短信是否为垃圾短信
     */
    public SMSDetectionResponse detectSMS(String content) {
        try {
            // 调用Python ML服务进行预测
            SMSDetectionResponse response = callMLService(content);
            
            // 保存检测记录到数据库
            saveDetectionRecord(content, response);
            
            return response;
        } catch (Exception e) {
            log.error("短信检测失败: {}", e.getMessage(), e);
            throw new RuntimeException("短信检测失败，请稍后重试");
        }
    }

    /**
     * 调用Python ML服务
     */
    private SMSDetectionResponse callMLService(String content) throws Exception {
        String mlUrl = mlServerUrl + predictEndpoint;
        
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(mlUrl);
            
            // 构建请求体
            JSONObject requestBody = new JSONObject();
            requestBody.put("text", content);
            
            httpPost.setEntity(new StringEntity(requestBody.toString(), StandardCharsets.UTF_8));
            httpPost.setHeader("Content-Type", "application/json");
            
            // 执行请求
            var response = httpClient.execute(httpPost, classicHttpResponse -> {
                String responseBody = EntityUtils.toString(classicHttpResponse.getEntity());
                
                // 解析响应
                JSONObject jsonResponse = JSON.parseObject(responseBody);
                
                // 检查响应状态
                int code = jsonResponse.getIntValue("code");
                if (code != 200) {
                    throw new RuntimeException("ML服务返回错误: " + jsonResponse.getString("message"));
                }
                
                // 获取data字段中的结果
                JSONObject data = jsonResponse.getJSONObject("data");
                
                SMSDetectionResponse result = new SMSDetectionResponse();
                result.setLabel(data.getString("label"));
                result.setConfidence(data.getDoubleValue("confidence"));
                result.setNormalProbability(data.getDoubleValue("normal_prob"));
                result.setSpamProbability(data.getDoubleValue("spam_prob"));
                result.setModelVersion(data.getString("model_version"));
                result.setTimestamp(System.currentTimeMillis());
                
                return result;
            });
            
            return response;
        }
    }

    /**
     * 保存检测记录
     */
    private void saveDetectionRecord(String content, SMSDetectionResponse response) {
        SMSDetectionRecord record = new SMSDetectionRecord();
        record.setSmsContent(content);
        record.setLabel(response.getLabel());
        record.setConfidence(response.getConfidence());
        record.setClassification("spam".equals(response.getLabel()) ? 1 : 0);
        record.setDetectionTime(LocalDateTime.now());
        record.setModelVersion(response.getModelVersion());
        
        recordRepository.save(record);
    }

    /**
     * 获取统计信息
     */
    public StatisticsDTO getStatistics() {
        Long totalCount = recordRepository.countTotal();
        Long spamCount = recordRepository.countSpam();
        Long normalCount = recordRepository.countNormal();
        
        StatisticsDTO dto = new StatisticsDTO();
        dto.setTotalDetections(totalCount);
        dto.setSpamCount(spamCount);
        dto.setNormalCount(normalCount);
        
        if (totalCount > 0) {
            dto.setSpamPercentage(Double.parseDouble(String.format("%.2f", 
                (spamCount.doubleValue() / totalCount) * 100)));
            dto.setNormalPercentage(Double.parseDouble(String.format("%.2f", 
                (normalCount.doubleValue() / totalCount) * 100)));
        } else {
            dto.setSpamPercentage(0.0);
            dto.setNormalPercentage(0.0);
        }
        
        return dto;
    }

    /**
     * 获取最近N条检测记录
     */
    public Object getRecentRecords(int limit) {
        return recordRepository.findAll()
                .stream()
                .skip(Math.max(0, recordRepository.count() - limit))
                .collect(java.util.stream.Collectors.toList());
    }
}
