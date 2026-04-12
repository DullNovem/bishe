package com.bishe.controller;

import com.bishe.entity.ApiResponse;
import com.bishe.entity.BatchDetectionResponse;
import com.bishe.entity.BatchDetectionTaskResponse;
import com.bishe.entity.DetectionTrendPointDTO;
import com.bishe.entity.FeedbackExportResponse;
import com.bishe.entity.FeedbackKeywordStatDTO;
import com.bishe.entity.FeedbackRequest;
import com.bishe.entity.FeedbackSample;
import com.bishe.entity.FeedbackStatusUpdateRequest;
import com.bishe.entity.KeywordInsightDTO;
import com.bishe.entity.KeywordRuleConfig;
import com.bishe.entity.SMSDetectionRequest;
import com.bishe.entity.SMSDetectionResponse;
import com.bishe.entity.StatisticsDTO;
import com.bishe.entity.TrainingDatasetResponse;
import com.bishe.service.BatchDetectionTaskService;
import com.bishe.service.FeedbackSampleService;
import com.bishe.service.KeywordRuleService;
import com.bishe.service.SMSDetectionService;
import lombok.extern.slf4j.Slf4j;
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
@RequestMapping(value = "/detection", produces = "application/json;charset=UTF-8")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SMSDetectionController {
    private final SMSDetectionService detectionService;
    private final KeywordRuleService keywordRuleService;
    private final FeedbackSampleService feedbackSampleService;
    private final BatchDetectionTaskService batchDetectionTaskService;

    public SMSDetectionController(
            SMSDetectionService detectionService,
            KeywordRuleService keywordRuleService,
            FeedbackSampleService feedbackSampleService,
            BatchDetectionTaskService batchDetectionTaskService) {
        this.detectionService = detectionService;
        this.keywordRuleService = keywordRuleService;
        this.feedbackSampleService = feedbackSampleService;
        this.batchDetectionTaskService = batchDetectionTaskService;
    }

    @PostMapping("/detect")
    public ApiResponse<SMSDetectionResponse> detectSMS(@RequestBody SMSDetectionRequest request) {
        try {
            if (request.getContent() == null || request.getContent().trim().isEmpty()) {
                return ApiResponse.error(400, "短信内容不能为空");
            }
            String lang = request.getLang() != null ? request.getLang() : "en";
            return ApiResponse.success("检测成功", detectionService.detectSMS(request.getContent(), lang, request.getUserId()));
        } catch (Exception e) {
            log.error("detect failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "检测失败: " + e.getMessage());
        }
    }

    @PostMapping("/batch-detect")
    public ApiResponse<BatchDetectionResponse> batchDetect(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "en") String lang,
            @RequestParam(required = false) Long userId) {
        try {
            if (file == null || file.isEmpty()) {
                return ApiResponse.error(400, "上传文件不能为空");
            }
            return ApiResponse.success("批量检测成功", detectionService.batchDetect(file, lang, userId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("batch detect failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "批量检测失败: " + e.getMessage());
        }
    }

    @PostMapping("/batch-detect/tasks")
    public ApiResponse<BatchDetectionTaskResponse> createBatchDetectionTask(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "en") String lang,
            @RequestParam(required = false) Long userId) {
        try {
            if (file == null || file.isEmpty()) {
                return ApiResponse.error(400, "上传文件不能为空");
            }
            return ApiResponse.success("批量任务已创建", batchDetectionTaskService.createTask(file, lang, userId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("create batch task failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "创建批量任务失败: " + e.getMessage());
        }
    }

    @GetMapping("/batch-detect/tasks/{taskId}")
    public ApiResponse<BatchDetectionTaskResponse> getBatchDetectionTask(@PathVariable String taskId) {
        try {
            return ApiResponse.success("获取成功", batchDetectionTaskService.getTask(taskId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(404, e.getMessage());
        } catch (Exception e) {
            log.error("get batch task failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取批量任务失败");
        }
    }

    @GetMapping("/keyword-rules")
    public ApiResponse<KeywordRuleConfig> getKeywordRules(@RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("获取成功", keywordRuleService.getConfig(userId));
        } catch (Exception e) {
            log.error("get keyword rules failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取关键词规则失败");
        }
    }

    @PutMapping("/keyword-rules")
    public ApiResponse<KeywordRuleConfig> updateKeywordRules(
            @RequestParam(required = false) Long userId,
            @RequestBody KeywordRuleConfig config) {
        try {
            return ApiResponse.success("保存成功", keywordRuleService.saveConfig(userId, config));
        } catch (Exception e) {
            log.error("save keyword rules failed: {}", e.getMessage(), e);
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
            log.error("submit feedback failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "提交纠错反馈失败");
        }
    }

    @GetMapping("/feedback")
    public ApiResponse<?> listFeedbackSamples(@RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("获取成功", feedbackSampleService.listFeedbackSamples(userId));
        } catch (Exception e) {
            log.error("list feedback failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取待审核样本失败");
        }
    }

    @PutMapping("/feedback/{id}/status")
    public ApiResponse<FeedbackSample> updateFeedbackStatus(
            @PathVariable Long id,
            @RequestParam(required = false) Long userId,
            @RequestBody FeedbackStatusUpdateRequest request) {
        try {
            return ApiResponse.success("更新成功", feedbackSampleService.updateStatus(id, request.getStatus(), userId));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("update feedback status failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "更新待审核样本状态失败");
        }
    }

    @DeleteMapping("/feedback/{id}")
    public ApiResponse<?> deleteFeedbackSample(
            @PathVariable Long id,
            @RequestParam(required = false) Long userId) {
        try {
            feedbackSampleService.deleteFeedbackSample(id, userId);
            return ApiResponse.success("删除成功", null);
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("delete feedback failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "删除待审核样本失败");
        }
    }

    @GetMapping("/feedback/export")
    public ApiResponse<FeedbackExportResponse> exportAcceptedFeedback(@RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("导出成功", feedbackSampleService.exportAcceptedSamples(userId));
        } catch (Exception e) {
            log.error("export feedback failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "导出已采纳样本失败");
        }
    }

    @PostMapping("/feedback/generate-training-dataset")
    public ApiResponse<TrainingDatasetResponse> generateTrainingDataset(@RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("生成成功", feedbackSampleService.generateTrainingDataset(userId));
        } catch (Exception e) {
            log.error("generate training dataset failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "生成训练集文件失败: " + e.getMessage());
        }
    }

    @GetMapping("/feedback/keyword-stats")
    public ApiResponse<List<FeedbackKeywordStatDTO>> getFeedbackKeywordStats(@RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("获取成功", feedbackSampleService.getMisjudgmentKeywordStats(userId));
        } catch (Exception e) {
            log.error("keyword stats failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取误判关键词统计失败");
        }
    }

    @GetMapping("/statistics")
    public ApiResponse<StatisticsDTO> getStatistics(@RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("获取成功", detectionService.getStatistics(userId));
        } catch (Exception e) {
            log.error("get statistics failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取统计数据失败");
        }
    }

    @GetMapping("/statistics/trend")
    public ApiResponse<List<DetectionTrendPointDTO>> getDetectionTrend(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("获取成功", detectionService.getDetectionTrend(userId, days));
        } catch (Exception e) {
            log.error("get detection trend failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取趋势数据失败");
        }
    }

    @GetMapping("/statistics/keyword-insights")
    public ApiResponse<List<KeywordInsightDTO>> getKeywordInsights(
            @RequestParam(defaultValue = "8") int limit,
            @RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("获取成功", detectionService.getKeywordInsights(userId, limit));
        } catch (Exception e) {
            log.error("get keyword insights failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取关键词统计失败");
        }
    }

    @GetMapping("/recent-records")
    public ApiResponse<?> getRecentRecords(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Long userId) {
        try {
            return ApiResponse.success("获取成功", detectionService.getRecentRecords(limit, userId));
        } catch (Exception e) {
            log.error("get recent records failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取记录失败");
        }
    }

    @GetMapping("/health")
    public ApiResponse<?> health() {
        return ApiResponse.success("系统运行正常", null);
    }
}
