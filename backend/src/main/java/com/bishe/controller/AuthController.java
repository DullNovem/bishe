package com.bishe.controller;

import com.bishe.entity.ApiResponse;
import com.bishe.entity.AuthLoginRequest;
import com.bishe.entity.AuthRegisterRequest;
import com.bishe.entity.UserProfileDTO;
import com.bishe.service.AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<UserProfileDTO> register(@RequestBody AuthRegisterRequest request) {
        try {
            return ApiResponse.success("注册成功", authService.register(request));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("register failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "注册失败");
        }
    }

    @PostMapping("/login")
    public ApiResponse<UserProfileDTO> login(@RequestBody AuthLoginRequest request) {
        try {
            return ApiResponse.success("登录成功", authService.login(request));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("login failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "登录失败");
        }
    }

    @GetMapping("/profile/{id}")
    public ApiResponse<UserProfileDTO> profile(@PathVariable Long id) {
        try {
            return ApiResponse.success("获取成功", authService.getUserProfile(id));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(400, e.getMessage());
        } catch (Exception e) {
            log.error("profile failed: {}", e.getMessage(), e);
            return ApiResponse.error(500, "获取用户信息失败");
        }
    }
}
