package com.bishe.entity;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KeywordRuleConfig {
    private List<String> strongWhitelistKeywords = new ArrayList<>();
    private List<String> strongBlacklistKeywords = new ArrayList<>();
    private List<String> weakWhitelistKeywords = new ArrayList<>();
    private List<String> weakBlacklistKeywords = new ArrayList<>();
}
