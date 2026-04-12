package com.bishe.repository;

import com.bishe.entity.FeedbackSample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedbackSampleRepository extends JpaRepository<FeedbackSample, Long> {
    List<FeedbackSample> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    List<FeedbackSample> findAllByOrderByCreatedAtDesc();

    List<FeedbackSample> findAllByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    List<FeedbackSample> findAllByStatusOrderByCreatedAtDesc(String status);
}
