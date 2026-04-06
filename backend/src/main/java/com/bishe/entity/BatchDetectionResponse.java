package com.bishe.entity;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class BatchDetectionResponse {
    private Integer totalCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer spamCount;
    private Integer suspiciousCount;
    private Integer normalCount;
    private String reportFileName;
    private String reportBase64;
    private List<BatchDetectionItem> items = new ArrayList<>();
}
