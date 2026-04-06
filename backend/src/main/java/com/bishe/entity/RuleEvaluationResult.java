package com.bishe.entity;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class RuleEvaluationResult {
    private String decisionSource;
    private String finalLabel;
    private String ruleNote;
    private Double riskScore;
    private Double modelSpamProbability;
    private List<String> matchedStrongWhitelistKeywords = new ArrayList<>();
    private List<String> matchedStrongBlacklistKeywords = new ArrayList<>();
    private List<String> matchedWeakWhitelistKeywords = new ArrayList<>();
    private List<String> matchedWeakBlacklistKeywords = new ArrayList<>();
}
