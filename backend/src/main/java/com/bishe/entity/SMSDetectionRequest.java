package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 短信检测请求DTO（支持语言选择）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SMSDetectionRequest {
    /**
     * 要检测的短信内容
     */
    private String content;

    /**
     * 用户标识（可选）
     */
    private String userId;

    /**
     * 语言类型: "en"（英文模型）或 "zh"（中文模型），默认 "en"
     */
    private String lang;
}