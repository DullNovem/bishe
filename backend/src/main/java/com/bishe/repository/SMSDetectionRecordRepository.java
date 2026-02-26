package com.bishe.repository;

import com.bishe.entity.SMSDetectionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

/**
 * 短信检测记录数据库访问层
 */
@Repository
public interface SMSDetectionRecordRepository extends JpaRepository<SMSDetectionRecord, Long> {
    /**
     * 查询垃圾短信总数
     */
    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE r.classification = 1")
    Long countSpam();

    /**
     * 查询正常短信总数
     */
    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r WHERE r.classification = 0")
    Long countNormal();

    /**
     * 查询总记录数
     */
    @Query("SELECT COUNT(r) FROM SMSDetectionRecord r")
    Long countTotal();
}
