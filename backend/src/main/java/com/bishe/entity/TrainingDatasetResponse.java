package com.bishe.entity;

import lombok.Data;

@Data
public class TrainingDatasetResponse {
    private String generatedDir;
    private String englishFilePath;
    private String chineseFilePath;
    private Integer englishSampleCount;
    private Integer chineseSampleCount;
    private Integer skippedSampleCount;
    private Boolean retrainTriggered;
    private Boolean reloadSuccessful;
    private String retrainSummary;
}
