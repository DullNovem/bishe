package com.bishe.entity;

import lombok.Data;

@Data
public class FeedbackRequest {
    private String content;
    private String predictedLabel;
    private String correctedLabel;
    private String lang;
    private String sourceType;
    private String decisionSource;
    private String ruleNote;
}
