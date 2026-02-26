package com.bishe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * Spring 应用配置类
 * 注册 RestTemplate Bean，用于调用 Python ML 服务
 */
@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        // 确保字符串消息转换器使用 UTF-8，避免中文乱码
        restTemplate.getMessageConverters().stream()
                .filter(c -> c instanceof StringHttpMessageConverter)
                .forEach(c -> ((StringHttpMessageConverter) c)
                        .setDefaultCharset(StandardCharsets.UTF_8));
        return restTemplate;
    }
}