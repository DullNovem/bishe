package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SMSDetectionResponse {
    private String label;
    private Double confidence;
    private Double normalProbability;
    private Double suspiciousProbability;
    private Double spamProbability;
    private Long timestamp;
    private String modelVersion;
    private String lang;
    private String decisionSource;
    private String ruleNote;
    private Double riskScore;
    private String explanationSummary;
    private List<String> matchedKeywords = new ArrayList<>();
    private List<DetectionExplanationItem> explanationItems = new ArrayList<>();
    private List<String> matchedStrongWhitelistKeywords = new ArrayList<>();
    private List<String> matchedStrongBlacklistKeywords = new ArrayList<>();
    private List<String> matchedWeakWhitelistKeywords = new ArrayList<>();
    private List<String> matchedWeakBlacklistKeywords = new ArrayList<>();
}
