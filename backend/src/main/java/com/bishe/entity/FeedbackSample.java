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
@Table(name = "feedback_sample")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackSample {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "LONGTEXT")
    private String smsContent;

    private String predictedLabel;

    private String correctedLabel;

    @Column(length = 10)
    private String lang;

    private String sourceType;

    private String decisionSource;

    @Column(columnDefinition = "LONGTEXT")
    private String ruleNote;

    @Column(length = 32)
    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime reviewedAt;
}
