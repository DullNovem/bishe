package com.bishe.service;

import com.bishe.entity.KeywordRuleConfig;
import com.bishe.entity.RuleEvaluationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class KeywordRuleService {
    private static final double WEAK_BLACKLIST_SCORE = 12.0;
    private static final double WEAK_WHITELIST_SCORE = 8.0;
    private static final double LINK_RISK_SCORE = 12.0;
    private static final double SHORT_LINK_RISK_SCORE = 8.0;
    private static final double MONEY_RISK_SCORE = 6.0;
    private static final double CONTACT_RISK_SCORE = 6.0;
    private static final double SAFE_NOTIFICATION_BONUS = 18.0;
    private static final double SPAM_THRESHOLD = 82.0;
    private static final double SUSPICIOUS_MIN_SCORE = 50.0;
    private static final double HIGH_SPAM_PROBABILITY = 0.88;
    private static final double LOW_SPAM_PROBABILITY = 0.20;
    private static final double UNCERTAIN_LOWER_BOUND = 0.35;
    private static final double UNCERTAIN_UPPER_BOUND = 0.72;

    private final ObjectMapper objectMapper;
    private final Path configPath = Paths.get("data", "keyword-rules.json");

    public KeywordRuleService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public synchronized KeywordRuleConfig getConfig() {
        ensureConfigExists();
        try {
            KeywordRuleConfig config = objectMapper.readValue(configPath.toFile(), KeywordRuleConfig.class);
            return normalizeConfig(config);
        } catch (IOException e) {
            throw new RuntimeException("读取关键词规则失败", e);
        }
    }

    public synchronized KeywordRuleConfig saveConfig(KeywordRuleConfig config) {
        ensureConfigExists();
        KeywordRuleConfig normalized = normalizeConfig(config == null ? new KeywordRuleConfig() : config);
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(configPath.toFile(), normalized);
            return normalized;
        } catch (IOException e) {
            throw new RuntimeException("保存关键词规则失败", e);
        }
    }

    public RuleEvaluationResult evaluate(String content, double spamProbability) {
        KeywordRuleConfig config = getConfig();
        String safeContent = content == null ? "" : content;
        String lowered = safeContent.toLowerCase(Locale.ROOT);

        List<String> strongWhitelistHits = findMatches(safeContent, config.getStrongWhitelistKeywords());
        List<String> strongBlacklistHits = findMatches(safeContent, config.getStrongBlacklistKeywords());
        List<String> weakWhitelistHits = findMatches(safeContent, config.getWeakWhitelistKeywords());
        List<String> weakBlacklistHits = findMatches(safeContent, config.getWeakBlacklistKeywords());
        boolean hasSafeNotificationPattern = containsSafeNotificationPattern(safeContent);
        boolean hasContactPattern = containsContactPattern(safeContent);
        boolean hasLink = containsLink(lowered);

        RuleEvaluationResult result = new RuleEvaluationResult();
        result.setModelSpamProbability(spamProbability);
        result.setMatchedStrongWhitelistKeywords(strongWhitelistHits);
        result.setMatchedStrongBlacklistKeywords(strongBlacklistHits);
        result.setMatchedWeakWhitelistKeywords(weakWhitelistHits);
        result.setMatchedWeakBlacklistKeywords(weakBlacklistHits);

        if (!strongBlacklistHits.isEmpty()) {
            result.setDecisionSource("rule:strong-blacklist");
            result.setFinalLabel("spam");
            result.setRiskScore(100.0);
            result.setRuleNote("命中强黑名单关键词，直接判定为垃圾短信");
            return result;
        }

        if (!strongWhitelistHits.isEmpty()) {
            result.setDecisionSource("rule:strong-whitelist");
            result.setFinalLabel("normal");
            result.setRiskScore(0.0);
            result.setRuleNote("命中强白名单关键词，直接判定为正常短信");
            return result;
        }

        boolean hasShortLink = containsShortLink(lowered);
        boolean hasMoneyPattern = containsMoneyPattern(safeContent);

        if (hasSafeNotificationPattern && !hasLink && !hasContactPattern && weakBlacklistHits.isEmpty()) {
            result.setDecisionSource("fusion:safe-pattern");
            result.setFinalLabel("normal");
            result.setRiskScore(Math.max(0.0, spamProbability * 100 - SAFE_NOTIFICATION_BONUS));
            result.setRuleNote("命中验证码或通知类安全模式，且未发现高风险特征，直接进入正常短信");
            return result;
        }

        double score = spamProbability * 100
                + weakBlacklistHits.size() * WEAK_BLACKLIST_SCORE
                - weakWhitelistHits.size() * WEAK_WHITELIST_SCORE
                + calculateExtraRiskScore(lowered, safeContent);

        if (hasSafeNotificationPattern && !hasLink && !hasContactPattern) {
            score -= SAFE_NOTIFICATION_BONUS;
        }

        score = Math.max(0.0, Math.min(100.0, score));
        result.setRiskScore(score);

        boolean highRiskCombination = hasLink && (hasMoneyPattern || hasContactPattern || hasShortLink || !weakBlacklistHits.isEmpty());
        boolean modelSaysSpam = spamProbability >= HIGH_SPAM_PROBABILITY;
        boolean modelSaysNormal = spamProbability <= LOW_SPAM_PROBABILITY;
        boolean modelUncertain = spamProbability > UNCERTAIN_LOWER_BOUND && spamProbability < UNCERTAIN_UPPER_BOUND;
        boolean weakRuleSuggestsSpam = !weakBlacklistHits.isEmpty() || score >= 65.0;
        boolean weakRuleSuggestsNormal = (!weakWhitelistHits.isEmpty() || hasSafeNotificationPattern) && weakBlacklistHits.isEmpty() && score <= 40.0;
        boolean hasRuleConflict = (modelSaysSpam && weakRuleSuggestsNormal) || (modelSaysNormal && weakRuleSuggestsSpam);
        boolean hasKeywordConflict = !weakWhitelistHits.isEmpty() && !weakBlacklistHits.isEmpty();

        if (highRiskCombination && score >= 68.0) {
            result.setDecisionSource("fusion:composite-high-risk");
            result.setFinalLabel("spam");
            result.setRuleNote("短信同时包含链接与高风险要素，直接提升为垃圾短信");
        } else if (score >= SPAM_THRESHOLD || (modelSaysSpam && score >= 68.0 && weakWhitelistHits.isEmpty())) {
            result.setDecisionSource("fusion:high-risk");
            result.setFinalLabel("spam");
            result.setRuleNote("模型高风险信号与规则特征共同表明风险较高，进入垃圾短信");
        } else if (hasRuleConflict || hasKeywordConflict) {
            result.setDecisionSource("fusion:rule-conflict");
            result.setFinalLabel("suspicious");
            result.setRuleNote("模型判断与弱规则信号存在冲突，暂时进入可疑短信等待进一步确认");
        } else if (modelUncertain && score >= SUSPICIOUS_MIN_SCORE && score < SPAM_THRESHOLD) {
            result.setDecisionSource("fusion:low-confidence");
            result.setFinalLabel("suspicious");
            result.setRuleNote("模型处于低置信度区间，且风险特征不足以直接判为垃圾，进入可疑短信");
        } else {
            result.setDecisionSource("fusion:low-risk");
            result.setFinalLabel("normal");
            result.setRuleNote("未命中强风险规则，且综合风险较低，进入正常短信");
        }

        return result;
    }

    private double calculateExtraRiskScore(String lowered, String original) {
        double score = 0.0;
        if (containsLink(lowered)) {
            score += LINK_RISK_SCORE;
        }
        if (containsShortLink(lowered)) {
            score += SHORT_LINK_RISK_SCORE;
        }
        if (containsMoneyPattern(original)) {
            score += MONEY_RISK_SCORE;
        }
        if (containsContactPattern(original)) {
            score += CONTACT_RISK_SCORE;
        }
        return score;
    }

    private boolean containsLink(String content) {
        return content.contains("http://")
                || content.contains("https://")
                || content.contains("www.")
                || content.contains(".com")
                || content.contains(".cn");
    }

    private boolean containsShortLink(String content) {
        return content.contains("t.cn/")
                || content.contains("bit.ly/")
                || content.contains("goo.gl/")
                || content.contains("tinyurl")
                || content.contains("url.cn/");
    }

    private boolean containsMoneyPattern(String content) {
        return content.matches(".*(\\d+\\s*(元|万元|万|块|rmb|￥|¥)).*");
    }

    private boolean containsContactPattern(String content) {
        return content.matches(".*((1\\d{10})|(QQ[:：]?\\d{5,})|(微信[:：]?[A-Za-z0-9_-]{5,})).*");
    }

    private boolean containsSafeNotificationPattern(String content) {
        return content.contains("验证码")
                || content.contains("校验码")
                || content.contains("取件码")
                || content.contains("提货码")
                || content.matches(".*【[^】]{1,12}】.*(验证码|校验码|取件码|提货码).*\\d{4,8}.*");
    }

    private void ensureConfigExists() {
        try {
            if (Files.notExists(configPath.getParent())) {
                Files.createDirectories(configPath.getParent());
            }
            if (Files.notExists(configPath)) {
                objectMapper.writerWithDefaultPrettyPrinter().writeValue(configPath.toFile(), new KeywordRuleConfig());
            }
        } catch (IOException e) {
            throw new RuntimeException("初始化关键词规则文件失败", e);
        }
    }

    private KeywordRuleConfig normalizeConfig(KeywordRuleConfig config) {
        KeywordRuleConfig normalized = new KeywordRuleConfig();
        normalized.setStrongWhitelistKeywords(normalizeKeywords(config.getStrongWhitelistKeywords()));
        normalized.setStrongBlacklistKeywords(normalizeKeywords(config.getStrongBlacklistKeywords()));
        normalized.setWeakWhitelistKeywords(normalizeKeywords(config.getWeakWhitelistKeywords()));
        normalized.setWeakBlacklistKeywords(normalizeKeywords(config.getWeakBlacklistKeywords()));
        return normalized;
    }

    private List<String> findMatches(String content, List<String> keywords) {
        String lowered = content.toLowerCase(Locale.ROOT);
        return normalizeKeywords(keywords).stream()
                .filter(keyword -> lowered.contains(keyword.toLowerCase(Locale.ROOT)))
                .collect(Collectors.toList());
    }

    private List<String> normalizeKeywords(List<String> source) {
        if (source == null) {
            return List.of();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String keyword : source) {
            if (keyword == null) {
                continue;
            }
            String trimmed = keyword.trim();
            if (!trimmed.isEmpty()) {
                normalized.add(trimmed);
            }
        }
        return normalized.stream().collect(Collectors.toList());
    }
}
