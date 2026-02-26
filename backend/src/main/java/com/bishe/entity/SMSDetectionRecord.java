package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 短信检测记录实体类
 */
@Entity
@Table(name = "sms_detection_record")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SMSDetectionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 检测的短信内容
     */
    @Column(columnDefinition = "LONGTEXT")
    private String smsContent;

    /**
     * 检测结果: 0=正常, 1=垃圾
     */
    private Integer classification;

    /**
     * 分类标签: "normal"或"spam"
     */
    private String label;

    /**
     * 垃圾短信置信度 (0-1)
     */
    private Double confidence;

    /**
     * 检测时间
     */
    private LocalDateTime detectionTime;

    /**
     * 模型版本号
     */
    private String modelVersion;
}
