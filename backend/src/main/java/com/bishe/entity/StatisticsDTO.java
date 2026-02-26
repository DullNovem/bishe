package com.bishe.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统计信息DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsDTO {
    /**
     * 总检测次数
     */
    private Long totalDetections;

    /**
     * 垃圾短信数量
     */
    private Long spamCount;

    /**
     * 正常短信数量
     */
    private Long normalCount;

    /**
     * 垃圾短信比例
     */
    private Double spamPercentage;

    /**
     * 正常短信比例
     */
    private Double normalPercentage;
}
