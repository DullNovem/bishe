package com.bishe.service;

import com.bishe.entity.FeedbackExportResponse;
import com.bishe.entity.FeedbackKeywordStatDTO;
import com.bishe.entity.FeedbackRequest;
import com.bishe.entity.FeedbackSample;
import com.bishe.entity.KeywordRuleConfig;
import com.bishe.entity.TrainingDatasetResponse;
import com.bishe.repository.FeedbackSampleRepository;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class FeedbackSampleService {
    private static final DateTimeFormatter FILE_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final FeedbackSampleRepository feedbackSampleRepository;
    private final KeywordRuleService keywordRuleService;
    private final ModelTrainingService modelTrainingService;

    public FeedbackSampleService(
            FeedbackSampleRepository feedbackSampleRepository,
            KeywordRuleService keywordRuleService,
            ModelTrainingService modelTrainingService) {
        this.feedbackSampleRepository = feedbackSampleRepository;
        this.keywordRuleService = keywordRuleService;
        this.modelTrainingService = modelTrainingService;
    }

    public FeedbackSample submitFeedback(FeedbackRequest request) {
        if (request.getUserId() == null) {
            throw new IllegalArgumentException("用户标识不能为空");
        }
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new IllegalArgumentException("短信内容不能为空");
        }
        if (!isValidLabel(request.getPredictedLabel()) || !isValidLabel(request.getCorrectedLabel())) {
            throw new IllegalArgumentException("反馈标签非法");
        }

        FeedbackSample sample = new FeedbackSample();
        sample.setUserId(request.getUserId());
        sample.setSmsContent(request.getContent().trim());
        sample.setPredictedLabel(request.getPredictedLabel());
        sample.setCorrectedLabel(request.getCorrectedLabel());
        sample.setLang(request.getLang());
        sample.setSourceType(request.getSourceType() == null || request.getSourceType().isBlank() ? "single" : request.getSourceType());
        sample.setDecisionSource(request.getDecisionSource());
        sample.setRuleNote(request.getRuleNote());
        sample.setStatus("pending");
        sample.setCreatedAt(LocalDateTime.now());
        sample.setReviewedAt(null);
        return feedbackSampleRepository.save(sample);
    }

    public List<FeedbackSample> listFeedbackSamples(Long userId) {
        return userId == null
                ? feedbackSampleRepository.findAllByOrderByCreatedAtDesc()
                : feedbackSampleRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
    }

    public FeedbackSample updateStatus(Long id, String status, Long userId) {
        if (!"pending".equals(status) && !"accepted".equals(status) && !"ignored".equals(status)) {
            throw new IllegalArgumentException("状态非法");
        }

        FeedbackSample sample = feedbackSampleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("反馈样本不存在"));
        ensureOwnership(sample, userId);
        sample.setStatus(status);
        sample.setReviewedAt("pending".equals(status) ? null : LocalDateTime.now());
        return feedbackSampleRepository.saveAndFlush(sample);
    }

    public void deleteFeedbackSample(Long id, Long userId) {
        FeedbackSample sample = feedbackSampleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("反馈样本不存在"));
        ensureOwnership(sample, userId);
        feedbackSampleRepository.delete(sample);
    }

    public FeedbackExportResponse exportAcceptedSamples(Long userId) {
        List<FeedbackSample> acceptedSamples = loadAcceptedSamples(userId);
        String csv = buildAcceptedSamplesCsv(acceptedSamples);

        FeedbackExportResponse response = new FeedbackExportResponse();
        response.setSampleCount(acceptedSamples.size());
        response.setFileName("accepted-feedback-samples-" + LocalDateTime.now().format(FILE_TIME_FORMAT) + ".csv");
        response.setFileBase64(Base64.getEncoder().encodeToString(csv.getBytes(StandardCharsets.UTF_8)));
        return response;
    }

    public TrainingDatasetResponse generateTrainingDataset(Long userId) {
        List<FeedbackSample> acceptedSamples = loadAcceptedSamples(userId);
        Path generatedDir = Paths.get("..", "ml-model", "data", "generated");

        try {
            Files.createDirectories(generatedDir);
        } catch (IOException e) {
            throw new RuntimeException("创建训练集目录失败", e);
        }

        List<FeedbackSample> trainable = acceptedSamples.stream()
                .filter(sample -> "normal".equals(sample.getCorrectedLabel()) || "spam".equals(sample.getCorrectedLabel()))
                .collect(Collectors.toList());

        List<String> englishLines = new ArrayList<>();
        List<String> chineseLines = new ArrayList<>();

        for (FeedbackSample sample : trainable) {
            if ("zh".equals(sample.getLang())) {
                chineseLines.add(toChineseTrainingLine(sample));
            } else {
                englishLines.add(toEnglishTrainingLine(sample));
            }
        }

        String timestamp = LocalDateTime.now().format(FILE_TIME_FORMAT);
        Path englishPath = generatedDir.resolve("accepted_feedback_en_" + timestamp + ".tsv");
        Path chinesePath = generatedDir.resolve("accepted_feedback_zh_" + timestamp + ".txt");

        writeTextFile(englishPath, String.join(System.lineSeparator(), englishLines));
        writeTextFile(chinesePath, String.join(System.lineSeparator(), chineseLines));

        TrainingDatasetResponse response = new TrainingDatasetResponse();
        response.setGeneratedDir(generatedDir.toAbsolutePath().normalize().toString());
        response.setEnglishFilePath(englishPath.toAbsolutePath().normalize().toString());
        response.setChineseFilePath(chinesePath.toAbsolutePath().normalize().toString());
        response.setEnglishSampleCount(englishLines.size());
        response.setChineseSampleCount(chineseLines.size());
        response.setSkippedSampleCount(acceptedSamples.size() - trainable.size());
        response.setRetrainTriggered(Boolean.TRUE);

        String trainingOutput = modelTrainingService.retrainAndReload(
                englishPath.toAbsolutePath().normalize().toString(),
                chinesePath.toAbsolutePath().normalize().toString()
        );
        response.setReloadSuccessful(Boolean.TRUE);
        response.setRetrainSummary(trainingOutput);
        return response;
    }

    public List<FeedbackKeywordStatDTO> getMisjudgmentKeywordStats(Long userId) {
        List<FeedbackSample> acceptedSamples = loadAcceptedSamples(userId);
        KeywordRuleConfig config = keywordRuleService.getMergedConfig(userId);

        Map<String, FeedbackKeywordStatDTO> stats = new LinkedHashMap<>();
        addKeywordMatches(stats, acceptedSamples, config.getStrongWhitelistKeywords(), "强白名单");
        addKeywordMatches(stats, acceptedSamples, config.getStrongBlacklistKeywords(), "强黑名单");
        addKeywordMatches(stats, acceptedSamples, config.getWeakWhitelistKeywords(), "弱白名单");
        addKeywordMatches(stats, acceptedSamples, config.getWeakBlacklistKeywords(), "弱黑名单");

        return stats.values().stream()
                .sorted(Comparator.comparing(FeedbackKeywordStatDTO::getHitCount).reversed())
                .limit(20)
                .collect(Collectors.toList());
    }

    private List<FeedbackSample> loadAcceptedSamples(Long userId) {
        return userId == null
                ? feedbackSampleRepository.findAllByStatusOrderByCreatedAtDesc("accepted")
                : feedbackSampleRepository.findAllByUserIdAndStatusOrderByCreatedAtDesc(userId, "accepted");
    }

    private void addKeywordMatches(Map<String, FeedbackKeywordStatDTO> stats,
                                   List<FeedbackSample> samples,
                                   List<String> keywords,
                                   String ruleType) {
        for (String keyword : keywords) {
            long hitCount = samples.stream()
                    .filter(sample -> sample.getSmsContent() != null && sample.getSmsContent().contains(keyword))
                    .count();
            if (hitCount > 0) {
                stats.put(ruleType + "::" + keyword, new FeedbackKeywordStatDTO(keyword, ruleType, hitCount));
            }
        }
    }

    private String buildAcceptedSamplesCsv(List<FeedbackSample> samples) {
        StringBuilder builder = new StringBuilder();
        builder.append('\uFEFF');
        builder.append("ID,用户ID,短信内容,原预测结果,纠错结果,语言,来源,判定来源,规则说明,状态,提交时间,审核时间\n");
        for (FeedbackSample sample : samples) {
            builder.append(sample.getId()).append(',')
                    .append(sample.getUserId()).append(',')
                    .append(csvEscape(sample.getSmsContent())).append(',')
                    .append(csvEscape(sample.getPredictedLabel())).append(',')
                    .append(csvEscape(sample.getCorrectedLabel())).append(',')
                    .append(csvEscape(sample.getLang())).append(',')
                    .append(csvEscape(sample.getSourceType())).append(',')
                    .append(csvEscape(sample.getDecisionSource())).append(',')
                    .append(csvEscape(sample.getRuleNote())).append(',')
                    .append(csvEscape(sample.getStatus())).append(',')
                    .append(csvEscape(String.valueOf(sample.getCreatedAt()))).append(',')
                    .append(csvEscape(String.valueOf(sample.getReviewedAt())))
                    .append('\n');
        }
        return builder.toString();
    }

    private String toEnglishTrainingLine(FeedbackSample sample) {
        String label = "spam".equals(sample.getCorrectedLabel()) ? "spam" : "ham";
        return label + "\t" + sanitizeTrainingText(sample.getSmsContent());
    }

    private String toChineseTrainingLine(FeedbackSample sample) {
        String label = "spam".equals(sample.getCorrectedLabel()) ? "1" : "0";
        return label + "\t" + sanitizeTrainingText(sample.getSmsContent());
    }

    private String sanitizeTrainingText(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\r", " ").replace("\n", " ").trim();
    }

    private void writeTextFile(Path path, String content) {
        try {
            Files.writeString(path, content, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("写入训练集文件失败", e);
        }
    }

    private String csvEscape(String value) {
        String safe = value == null ? "" : value;
        if (safe.contains(",") || safe.contains("\"") || safe.contains("\n")) {
            return "\"" + safe.replace("\"", "\"\"") + "\"";
        }
        return safe;
    }

    private boolean isValidLabel(String label) {
        return "normal".equals(label) || "spam".equals(label) || "suspicious".equals(label);
    }

    private void ensureOwnership(FeedbackSample sample, Long userId) {
        if (userId == null) {
            return;
        }
        if (!userId.equals(sample.getUserId())) {
            throw new IllegalArgumentException("无权操作其他用户的数据");
        }
    }
}
