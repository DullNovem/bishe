package com.bishe.service;

import com.bishe.entity.KeywordRuleConfig;
import com.bishe.entity.RuleEvaluationResult;
import com.bishe.entity.UserKeywordRuleConfigEntity;
import com.bishe.repository.UserKeywordRuleConfigRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
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
    private final UserKeywordRuleConfigRepository userKeywordRuleConfigRepository;
    private final Path systemConfigPath = Paths.get("data", "keyword-rules.json");

    public KeywordRuleService(ObjectMapper objectMapper,
                              UserKeywordRuleConfigRepository userKeywordRuleConfigRepository) {
        this.objectMapper = objectMapper;
        this.userKeywordRuleConfigRepository = userKeywordRuleConfigRepository;
    }

    public synchronized KeywordRuleConfig getSystemConfig() {
        ensureSystemConfigExists();
        try {
            return normalizeConfig(objectMapper.readValue(systemConfigPath.toFile(), KeywordRuleConfig.class));
        } catch (IOException e) {
            throw new RuntimeException("读取系统规则失败", e);
        }
    }

    public synchronized KeywordRuleConfig getConfig(Long userId) {
        if (userId == null) {
            return getSystemConfig();
        }
        return userKeywordRuleConfigRepository.findByUserId(userId)
                .map(this::toConfig)
                .orElseGet(KeywordRuleConfig::new);
    }

    public synchronized KeywordRuleConfig saveConfig(Long userId, KeywordRuleConfig config) {
        if (userId == null) {
            return saveSystemConfig(config);
        }

        KeywordRuleConfig normalized = normalizeConfig(config == null ? new KeywordRuleConfig() : config);
        UserKeywordRuleConfigEntity entity = userKeywordRuleConfigRepository.findByUserId(userId)
                .orElseGet(UserKeywordRuleConfigEntity::new);
        entity.setUserId(userId);
        entity.setStrongWhitelistKeywordsJson(writeList(normalized.getStrongWhitelistKeywords()));
        entity.setStrongBlacklistKeywordsJson(writeList(normalized.getStrongBlacklistKeywords()));
        entity.setWeakWhitelistKeywordsJson(writeList(normalized.getWeakWhitelistKeywords()));
        entity.setWeakBlacklistKeywordsJson(writeList(normalized.getWeakBlacklistKeywords()));
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(LocalDateTime.now());
        }
        entity.setUpdatedAt(LocalDateTime.now());
        userKeywordRuleConfigRepository.save(entity);
        return normalized;
    }

    public KeywordRuleConfig getMergedConfig(Long userId) {
        return mergeConfigs(getSystemConfig(), getConfig(userId));
    }

    public RuleEvaluationResult evaluate(String content, double spamProbability, Long userId) {
        KeywordRuleConfig config = getMergedConfig(userId);
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
            result.setRuleNote("命中安全通知模式且未发现高风险特征，进入正常短信");
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
            result.setRuleNote("模型判断与弱规则信号存在冲突，进入可疑短信");
        } else if (modelUncertain && score >= SUSPICIOUS_MIN_SCORE && score < SPAM_THRESHOLD) {
            result.setDecisionSource("fusion:low-confidence");
            result.setFinalLabel("suspicious");
            result.setRuleNote("模型低置信度且存在一定风险特征，进入可疑短信");
        } else {
            result.setDecisionSource("fusion:low-risk");
            result.setFinalLabel("normal");
            result.setRuleNote("未命中高风险规则且综合风险较低，进入正常短信");
        }

        return result;
    }

    public KeywordRuleConfig mergeConfigs(KeywordRuleConfig systemConfig, KeywordRuleConfig userConfig) {
        KeywordRuleConfig merged = new KeywordRuleConfig();
        merged.setStrongWhitelistKeywords(mergeKeywords(systemConfig.getStrongWhitelistKeywords(), userConfig.getStrongWhitelistKeywords()));
        merged.setStrongBlacklistKeywords(mergeKeywords(systemConfig.getStrongBlacklistKeywords(), userConfig.getStrongBlacklistKeywords()));
        merged.setWeakWhitelistKeywords(mergeKeywords(systemConfig.getWeakWhitelistKeywords(), userConfig.getWeakWhitelistKeywords()));
        merged.setWeakBlacklistKeywords(mergeKeywords(systemConfig.getWeakBlacklistKeywords(), userConfig.getWeakBlacklistKeywords()));
        return merged;
    }

    private synchronized KeywordRuleConfig saveSystemConfig(KeywordRuleConfig config) {
        ensureSystemConfigExists();
        KeywordRuleConfig normalized = normalizeConfig(config == null ? new KeywordRuleConfig() : config);
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(systemConfigPath.toFile(), normalized);
            return normalized;
        } catch (IOException e) {
            throw new RuntimeException("保存系统规则失败", e);
        }
    }

    private void ensureSystemConfigExists() {
        try {
            if (Files.notExists(systemConfigPath.getParent())) {
                Files.createDirectories(systemConfigPath.getParent());
            }
            if (Files.notExists(systemConfigPath)) {
                objectMapper.writerWithDefaultPrettyPrinter().writeValue(systemConfigPath.toFile(), new KeywordRuleConfig());
            }
        } catch (IOException e) {
            throw new RuntimeException("初始化系统规则文件失败", e);
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

    private KeywordRuleConfig toConfig(UserKeywordRuleConfigEntity entity) {
        KeywordRuleConfig config = new KeywordRuleConfig();
        config.setStrongWhitelistKeywords(readList(entity.getStrongWhitelistKeywordsJson()));
        config.setStrongBlacklistKeywords(readList(entity.getStrongBlacklistKeywordsJson()));
        config.setWeakWhitelistKeywords(readList(entity.getWeakWhitelistKeywordsJson()));
        config.setWeakBlacklistKeywords(readList(entity.getWeakBlacklistKeywordsJson()));
        return normalizeConfig(config);
    }

    private List<String> readList(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(rawJson, new TypeReference<List<String>>() {});
        } catch (IOException e) {
            return List.of();
        }
    }

    private String writeList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(normalizeKeywords(values));
        } catch (IOException e) {
            throw new RuntimeException("保存关键词列表失败", e);
        }
    }

    private List<String> mergeKeywords(List<String> systemKeywords, List<String> userKeywords) {
        Set<String> merged = new LinkedHashSet<>();
        merged.addAll(normalizeKeywords(systemKeywords));
        merged.addAll(normalizeKeywords(userKeywords));
        return new ArrayList<>(merged);
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
        return new ArrayList<>(normalized);
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
        return content.matches(".*(\\d+\\s*(元|万元|万|rmb|RMB)).*");
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
}
