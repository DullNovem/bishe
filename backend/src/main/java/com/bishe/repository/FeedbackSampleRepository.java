package com.bishe.repository;

import com.bishe.entity.FeedbackSample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedbackSampleRepository extends JpaRepository<FeedbackSample, Long> {
    List<FeedbackSample> findAllByOrderByCreatedAtDesc();

    List<FeedbackSample> findAllByStatusOrderByCreatedAtDesc(String status);
}
