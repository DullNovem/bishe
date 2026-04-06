package com.bishe.entity;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class BatchDetectionItem {
    private Integer rowNo;
    private String content;
    private String label;
    private Double confidence;
    private Double normalProbability;
    private Double suspiciousProbability;
    private Double spamProbability;
    private String lang;
    private String decisionSource;
    private String ruleNote;
    private Double riskScore;
    private List<String> matchedStrongWhitelistKeywords = new ArrayList<>();
    private List<String> matchedStrongBlacklistKeywords = new ArrayList<>();
    private List<String> matchedWeakWhitelistKeywords = new ArrayList<>();
    private List<String> matchedWeakBlacklistKeywords = new ArrayList<>();
    private String error;
}
