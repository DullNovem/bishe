package com.bishe.controller;

import com.bishe.entity.ApiResponse;
import com.bishe.entity.BatchDetectionResponse;
import com.bishe.entity.FeedbackExportResponse;
import com.bishe.entity.FeedbackKeywordStatDTO;
import com.bishe.entity.FeedbackRequest;
import com.bishe.entity.FeedbackSample;
import com.bishe.entity.FeedbackStatusUpdateRequest;
import com.bishe.entity.KeywordRuleConfig;
import com.bishe.entity.SMSDetectionRequest;
import com.bishe.entity.SMSDetectionResponse;
import com.bishe.entity.StatisticsDTO;
import com.bishe.entity.TrainingDatasetResponse;
import com.bishe.service.FeedbackSampleService;
import com.bishe.service.KeywordRuleService;
import com.bishe.service.SMSDetectionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/detection")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SMSDetectionController {

    @Autowired
    private SMSDetectionService detectionService;

    @Autowired
    private KeywordRuleService keywordRuleService;

    @Autowired
    private FeedbackSampleService feedbackSampleService;

    @PostMapping("/detect")
    public ApiResponse<SMSDetectionResponse> detectSMS(@RequestBody SMSDetectionRequest request) {
        try {
            if (request.getContent() == null || request.getContent().trim().isEmpty()) {
                return ApiResponse.error(400, "短信内容不能为空");
            }

            String lang = request.getLang() != null ? request.getLang() : "en";
            SMSDetectionResponse response = detectionService.detectSMS(request.getContent(), lang);
            return ApiResponse.success("检测成功", response);
        } catch (Exception e) {
            log.error("检测失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "检测失败: " + e.getMessage());
        }
    }

    @PostMapping("/batch-detect")
    public ApiResponse<BatchDetectionResponse> batchDetect(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "en") String lang) {
        try {
            if (file == null || file.isEmpty()) {
                return ApiResponse.error(400, "上传文件不能为空");
            }

            BatchDetectionResponse response = detectionService.batchDetect(file, lang);
            return ApiResponse.success("批量检测成功", response);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("批量检测失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "批量检测失败: " + e.getMessage());
        }
    }

    @GetMapping("/keyword-rules")
    public ApiResponse<KeywordRuleConfig> getKeywordRules() {
        try {
            return ApiResponse.success("获取成功", keywordRuleService.getConfig());
        } catch (Exception e) {
            log.error("获取关键词规则失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取关键词规则失败");
        }
    }

    @PutMapping("/keyword-rules")
    public ApiResponse<KeywordRuleConfig> updateKeywordRules(@RequestBody KeywordRuleConfig config) {
        try {
            return ApiResponse.success("保存成功", keywordRuleService.saveConfig(config));
        } catch (Exception e) {
            log.error("保存关键词规则失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "保存关键词规则失败");
        }
    }

    @PostMapping("/feedback")
    public ApiResponse<FeedbackSample> submitFeedback(@RequestBody FeedbackRequest request) {
        try {
            return ApiResponse.success("反馈提交成功", feedbackSampleService.submitFeedback(request));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("提交纠错反馈失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "提交纠错反馈失败");
        }
    }

    @GetMapping("/feedback")
    public ApiResponse<?> listFeedbackSamples() {
        try {
            return ApiResponse.success("获取成功", feedbackSampleService.listFeedbackSamples());
        } catch (Exception e) {
            log.error("获取待审核样本失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取待审核样本失败");
        }
    }

    @PutMapping("/feedback/{id}/status")
    public ApiResponse<FeedbackSample> updateFeedbackStatus(
            @PathVariable Long id,
            @RequestBody FeedbackStatusUpdateRequest request) {
        try {
            return ApiResponse.success("更新成功", feedbackSampleService.updateStatus(id, request.getStatus()));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("更新待审核样本状态失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "更新待审核样本状态失败");
        }
    }

    @DeleteMapping("/feedback/{id}")
    public ApiResponse<?> deleteFeedbackSample(@PathVariable Long id) {
        try {
            feedbackSampleService.deleteFeedbackSample(id);
            return ApiResponse.success("删除成功", null);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("删除待审核样本失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "删除待审核样本失败");
        }
    }

    @GetMapping("/feedback/export")
    public ApiResponse<FeedbackExportResponse> exportAcceptedFeedback() {
        try {
            return ApiResponse.success("导出成功", feedbackSampleService.exportAcceptedSamples());
        } catch (Exception e) {
            log.error("导出已采纳样本失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "导出已采纳样本失败");
        }
    }

    @PostMapping("/feedback/generate-training-dataset")
    public ApiResponse<TrainingDatasetResponse> generateTrainingDataset() {
        try {
            return ApiResponse.success("生成成功", feedbackSampleService.generateTrainingDataset());
        } catch (Exception e) {
            log.error("生成训练集文件失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "生成训练集文件失败: " + e.getMessage());
        }
    }

    @GetMapping("/feedback/keyword-stats")
    public ApiResponse<List<FeedbackKeywordStatDTO>> getFeedbackKeywordStats() {
        try {
            return ApiResponse.success("获取成功", feedbackSampleService.getMisjudgmentKeywordStats());
        } catch (Exception e) {
            log.error("获取误判关键词统计失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取误判关键词统计失败");
        }
    }

    @GetMapping("/statistics")
    public ApiResponse<StatisticsDTO> getStatistics() {
        try {
            StatisticsDTO statistics = detectionService.getStatistics();
            return ApiResponse.success("获取成功", statistics);
        } catch (Exception e) {
            log.error("获取统计数据失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取统计数据失败");
        }
    }

    @GetMapping("/recent-records")
    public ApiResponse<?> getRecentRecords(@RequestParam(defaultValue = "10") int limit) {
        try {
            Object records = detectionService.getRecentRecords(limit);
            return ApiResponse.success("获取成功", records);
        } catch (Exception e) {
            log.error("获取记录失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取记录失败");
        }
    }

    @GetMapping("/health")
    public ApiResponse<?> health() {
        return ApiResponse.success("系统运行正常", null);
    }
}