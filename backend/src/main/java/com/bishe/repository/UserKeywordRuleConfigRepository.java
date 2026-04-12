package com.bishe.repository;

import com.bishe.entity.UserKeywordRuleConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserKeywordRuleConfigRepository extends JpaRepository<UserKeywordRuleConfigEntity, Long> {
    Optional<UserKeywordRuleConfigEntity> findByUserId(Long userId);
}
