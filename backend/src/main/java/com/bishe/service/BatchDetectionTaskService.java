package com.bishe.service;

import com.bishe.entity.BatchDetectionResponse;
import com.bishe.entity.BatchDetectionTaskResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class BatchDetectionTaskService {
    private final SMSDetectionService detectionService;
    private final Map<String, BatchDetectionTaskResponse> tasks = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public BatchDetectionTaskService(SMSDetectionService detectionService) {
        this.detectionService = detectionService;
    }

    public BatchDetectionTaskResponse createTask(MultipartFile file, String lang, Long userId) {
        String taskId = UUID.randomUUID().toString().replace("-", "");
        BatchDetectionTaskResponse task = new BatchDetectionTaskResponse();
        task.setTaskId(taskId);
        task.setStatus("pending");
        task.setFileName(file.getOriginalFilename());
        task.setLang(lang);
        task.setUserId(userId);
        task.setCreatedAt(LocalDateTime.now());
        tasks.put(taskId, task);

        final byte[] fileBytes;
        final String fileName;
        try {
            fileBytes = file.getBytes();
            fileName = file.getOriginalFilename();
        } catch (IOException e) {
            task.setStatus("failed");
            task.setErrorMessage("读取上传文件失败");
            task.setFinishedAt(LocalDateTime.now());
            return task;
        }

        executor.submit(() -> processTask(taskId, fileName, fileBytes, lang, userId));
        return task;
    }

    public BatchDetectionTaskResponse getTask(String taskId) {
        BatchDetectionTaskResponse task = tasks.get(taskId);
        if (task == null) {
            throw new IllegalArgumentException("批量任务不存在");
        }
        return task;
    }

    private void processTask(String taskId, String fileName, byte[] fileBytes, String lang, Long userId) {
        BatchDetectionTaskResponse task = tasks.get(taskId);
        if (task == null) {
            return;
        }

        task.setStatus("processing");
        task.setStartedAt(LocalDateTime.now());

        try {
            BatchDetectionResponse response = detectionService.batchDetect(fileName, fileBytes, lang, userId);
            task.setStatus("completed");
            task.setTotalCount(response.getTotalCount());
            task.setProcessedCount(response.getTotalCount());
            task.setSuccessCount(response.getSuccessCount());
            task.setFailedCount(response.getFailedCount());
            task.setSpamCount(response.getSpamCount());
            task.setSuspiciousCount(response.getSuspiciousCount());
            task.setNormalCount(response.getNormalCount());
            task.setReportFileName(response.getReportFileName());
            task.setReportBase64(response.getReportBase64());
            task.setItems(response.getItems());
        } catch (Exception e) {
            task.setStatus("failed");
            task.setErrorMessage(e.getMessage());
        } finally {
            task.setFinishedAt(LocalDateTime.now());
        }
    }
}
