package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackKeywordStatDTO {
    private String keyword;
    private String ruleType;
    private Long hitCount;
}
