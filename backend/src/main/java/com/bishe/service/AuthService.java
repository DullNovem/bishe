package com.bishe.service;

import com.bishe.entity.AuthLoginRequest;
import com.bishe.entity.AuthRegisterRequest;
import com.bishe.entity.UserAccount;
import com.bishe.entity.UserProfileDTO;
import com.bishe.repository.UserAccountRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Service
public class AuthService {

    private final UserAccountRepository userAccountRepository;

    public AuthService(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    public UserProfileDTO register(AuthRegisterRequest request) {
        String username = safe(request.getUsername());
        String password = safe(request.getPassword());
        String displayName = safe(request.getDisplayName());
        String phone = safe(request.getPhone());
        String email = safe(request.getEmail());

        if (username.isEmpty() || password.isEmpty() || displayName.isEmpty()) {
            throw new IllegalArgumentException("用户名、密码和显示名称不能为空");
        }
        if (username.length() < 4 || username.length() > 32) {
            throw new IllegalArgumentException("用户名长度需在 4 到 32 位之间");
        }
        if (password.length() < 6 || password.length() > 32) {
            throw new IllegalArgumentException("密码长度需在 6 到 32 位之间");
        }
        if (userAccountRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("用户名已存在");
        }

        UserAccount account = new UserAccount();
        account.setUsername(username);
        account.setPasswordHash(hashPassword(password));
        account.setDisplayName(displayName);
        account.setPhone(phone);
        account.setEmail(email);
        account.setStatus("active");
        account.setCreatedAt(LocalDateTime.now());
        account.setLastLoginAt(LocalDateTime.now());
        return toProfile(userAccountRepository.save(account));
    }

    public UserProfileDTO login(AuthLoginRequest request) {
        String username = safe(request.getUsername());
        String password = safe(request.getPassword());
        if (username.isEmpty() || password.isEmpty()) {
            throw new IllegalArgumentException("用户名和密码不能为空");
        }

        UserAccount account = userAccountRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在或密码错误"));

        if (!"active".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalArgumentException("当前账号不可用");
        }

        if (!account.getPasswordHash().equals(hashPassword(password))) {
            throw new IllegalArgumentException("用户不存在或密码错误");
        }

        account.setLastLoginAt(LocalDateTime.now());
        return toProfile(userAccountRepository.save(account));
    }

    public UserProfileDTO getUserProfile(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("用户标识不能为空");
        }
        UserAccount account = userAccountRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        return toProfile(account);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String hashPassword(String rawPassword) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(rawPassword.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (Exception e) {
            throw new RuntimeException("密码加密失败", e);
        }
    }

    private UserProfileDTO toProfile(UserAccount account) {
        return new UserProfileDTO(
                account.getId(),
                account.getUsername(),
                account.getDisplayName(),
                account.getPhone(),
                account.getEmail(),
                account.getStatus(),
                account.getCreatedAt(),
                account.getLastLoginAt()
        );
    }
}
