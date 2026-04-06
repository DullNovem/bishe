package com.bishe.repository;

import com.bishe.entity.SMSDetectionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface SMSDetectionRecordRepository extends JpaRepository<SMSDetectionRecord, Long> {
    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE r.classification = 1")
    Long countSpam();

    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE r.classification = 2")
    Long countSuspicious();

    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE r.classification = 0")
    Long countNormal();

    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r")
    Long countTotal();
}
