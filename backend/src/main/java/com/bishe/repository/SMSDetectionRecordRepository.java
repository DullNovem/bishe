package com.bishe.repository;

import com.bishe.entity.SMSDetectionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SMSDetectionRecordRepository extends JpaRepository<SMSDetectionRecord, Long> {
    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE (:userId IS NULL OR r.userId = :userId) AND r.classification = 1")
    Long countSpam(@Param("userId") Long userId);

    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE (:userId IS NULL OR r.userId = :userId) AND r.classification = 2")
    Long countSuspicious(@Param("userId") Long userId);

    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE (:userId IS NULL OR r.userId = :userId) AND r.classification = 0")
    Long countNormal(@Param("userId") Long userId);

    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE (:userId IS NULL OR r.userId = :userId)")
    Long countTotal(@Param("userId") Long userId);

    List<SMSDetectionRecord> findTop100ByUserIdOrderByDetectionTimeDesc(Long userId);

    List<SMSDetectionRecord> findTop100ByOrderByDetectionTimeDesc();

    List<SMSDetectionRecord> findAllByDetectionTimeAfterOrderByDetectionTimeAsc(LocalDateTime detectionTime);

    List<SMSDetectionRecord> findAllByUserIdAndDetectionTimeAfterOrderByDetectionTimeAsc(Long userId, LocalDateTime detectionTime);
}
