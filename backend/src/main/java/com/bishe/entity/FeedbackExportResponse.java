package com.bishe.entity;

import lombok.Data;

@Data
public class FeedbackExportResponse {
    private String fileName;
    private String fileBase64;
    private Integer sampleCount;
}
