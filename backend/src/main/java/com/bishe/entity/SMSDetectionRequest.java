package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 短信检测请求DTO
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
}
