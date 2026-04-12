package com.bishe.entity;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class BatchDetectionTaskResponse {
    private String taskId;
    private String status;
    private String fileName;
    private String lang;
    private Long userId;
    private Integer totalCount;
    private Integer processedCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer spamCount;
    private Integer suspiciousCount;
    private Integer normalCount;
    private String reportFileName;
    private String reportBase64;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private List<BatchDetectionItem> items = new ArrayList<>();
}
