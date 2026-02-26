package com.bishe.controller;

import com.bishe.entity.ApiResponse;
import com.bishe.entity.SMSDetectionRequest;
import com.bishe.entity.SMSDetectionResponse;
import com.bishe.entity.StatisticsDTO;
import com.bishe.service.SMSDetectionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 短信检测 REST API 控制器
 */
@Slf4j
@RestController
@RequestMapping("/detection")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SMSDetectionController {

    @Autowired
    private SMSDetectionService detectionService;

    /**
     * 检测短信是否为垃圾短信
     * POST /api/detection/detect
     */
    @PostMapping("/detect")
    public ApiResponse<SMSDetectionResponse> detectSMS(@RequestBody SMSDetectionRequest request) {
        try {
            if (request.getContent() == null || request.getContent().trim().isEmpty()) {
                return ApiResponse.error(400, "短信内容不能为空");
            }
            
            SMSDetectionResponse response = detectionService.detectSMS(request.getContent());
            return ApiResponse.success("检测成功", response);
        } catch (Exception e) {
            log.error("检测失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "检测失败: " + e.getMessage());
        }
    }

    /**
     * 获取统计数据
     * GET /api/detection/statistics
     */
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

    /**
     * 获取最近的检测记录
     * GET /api/detection/recent-records?limit=10
     */
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

    /**
     * 健康检查
     * GET /api/detection/health
     */
    @GetMapping("/health")
    public ApiResponse<?> health() {
        return ApiResponse.success("系统运行正常", null);
    }
}
