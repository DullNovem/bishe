package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 短信检测响应DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SMSDetectionResponse {
    /**
     * 检测结果: "normal"或"spam"
     */
    private String label;

    /**
     * 置信度概率 (0-1)
     */
    private Double confidence;

    /**
     * 所有分类的概率分布
     */
    private Double normalProbability;
    private Double spamProbability;

    /**
     * 处理时间戳
     */
    private Long timestamp;

    /**
     * 模型版本
     */
    private String modelVersion;
}
