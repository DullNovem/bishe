package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DetectionTrendPointDTO {
    private String date;
    private Long totalCount;
    private Long spamCount;
    private Long suspiciousCount;
    private Long normalCount;
}
