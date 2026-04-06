package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsDTO {
    private Long totalDetections;
    private Long spamCount;
    private Long suspiciousCount;
    private Long normalCount;
    private Double spamPercentage;
    private Double suspiciousPercentage;
    private Double normalPercentage;
}
