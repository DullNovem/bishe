package com.bishe.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "sms_detection_record")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SMSDetectionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Column(columnDefinition = "LONGTEXT")
    private String smsContent;

    // 0=正常 1=垃圾 2=可疑
    private Integer classification;

    private String label;

    private Double confidence;

    private LocalDateTime detectionTime;

    private String modelVersion;

    @Column(length = 10)
    private String lang;
}
