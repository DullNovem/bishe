package com.bishe.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ModelTrainingService {

    @Autowired
    private RestTemplate restTemplate;

    @Value("${ml.server.url}")
    private String mlServerUrl;

    @Value("${ml.server.reload-endpoint:/reload-models}")
    private String reloadEndpoint;

    @Value("${ml.training.python-executable:../.venv/Scripts/python.exe}")
    private String pythonExecutable;

    @Value("${ml.training.script-path:../ml-model/src/retrain_from_feedback.py}")
    private String trainingScriptPath;

    @Value("${ml.training.workdir:../ml-model}")
    private String trainingWorkdir;

    @Value("${ml.training.timeout-seconds:300}")
    private long trainingTimeoutSeconds;

    public String retrainAndReload(String englishExtraPath, String chineseExtraPath) {
        String trainingOutput = runTrainingScript(englishExtraPath, chineseExtraPath);
        reloadModels();
        return trainingOutput;
    }

    private String runTrainingScript(String englishExtraPath, String chineseExtraPath) {
        Path workdir = resolvePath(trainingWorkdir);
        Path scriptPath = resolvePath(trainingScriptPath);
        List<String> command = resolvePythonCommand();
        command.add(scriptPath.toString());
        command.add("--lang");
        command.add("both");
        command.add("--english-extra");
        command.add(englishExtraPath == null ? "" : englishExtraPath);
        command.add("--chinese-extra");
        command.add(chineseExtraPath == null ? "" : chineseExtraPath);

        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workdir.toFile());
        builder.redirectErrorStream(true);

        try {
            Process process = builder.start();
            String output;
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                output = reader.lines().collect(Collectors.joining(System.lineSeparator()));
            }

            boolean finished = process.waitFor(trainingTimeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new RuntimeException("模型重训练超时，超过 " + trainingTimeoutSeconds + " 秒");
            }

            if (process.exitValue() != 0) {
                throw new RuntimeException("模型重训练失败: " + output);
            }

            log.info("模型重训练完成: {}", output);
            return output;
        } catch (IOException e) {
            throw new RuntimeException("启动训练脚本失败: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("模型重训练被中断", e);
        }
    }

    private void reloadModels() {
        String reloadUrl = mlServerUrl + reloadEndpoint;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                reloadUrl,
                HttpMethod.POST,
                new HttpEntity<>(new HashMap<>(), headers),
                new ParameterizedTypeReference<Map<String, Object>>() {}
        );

        Map<String, Object> body = response.getBody();
        if (body == null) {
            throw new RuntimeException("模型热加载返回空响应");
        }

        Object codeObj = body.get("code");
        int code = codeObj instanceof Number ? ((Number) codeObj).intValue() : response.getStatusCode().value();
        if (code != 200) {
            throw new RuntimeException("模型热加载失败: " + body.getOrDefault("message", "unknown error"));
        }
    }

    private Path resolvePath(String rawPath) {
        return Paths.get(rawPath).toAbsolutePath().normalize();
    }

    private List<String> resolvePythonCommand() {
        Path configuredPath = resolvePath(pythonExecutable);
        if (Files.exists(configuredPath)) {
            return new java.util.ArrayList<>(List.of(configuredPath.toString()));
        }

        if (isCommandAvailable("python")) {
            return new java.util.ArrayList<>(List.of("python"));
        }

        if (isPyLauncherAvailable()) {
            return new java.util.ArrayList<>(List.of("py"));
        }

        throw new RuntimeException("未找到可用的 Python 运行环境，无法执行自动重训练。请安装 Python 3.9+ 并修复 .venv 或 PATH。");
    }

    private boolean isCommandAvailable(String command) {
        try {
            Process process = new ProcessBuilder(command, "--version")
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(10, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isPyLauncherAvailable() {
        try {
            Process process = new ProcessBuilder("py", "-c", "import sys; print(sys.executable)")
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(10, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }
}
