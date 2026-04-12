package com.bishe.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_keyword_rule_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserKeywordRuleConfigEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long userId;

    @Column(columnDefinition = "LONGTEXT")
    private String strongWhitelistKeywordsJson;

    @Column(columnDefinition = "LONGTEXT")
    private String strongBlacklistKeywordsJson;

    @Column(columnDefinition = "LONGTEXT")
    private String weakWhitelistKeywordsJson;

    @Column(columnDefinition = "LONGTEXT")
    private String weakBlacklistKeywordsJson;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
