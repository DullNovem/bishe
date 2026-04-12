package com.bishe.service;

import com.bishe.entity.AuthLoginRequest;
import com.bishe.entity.AuthRegisterRequest;
import com.bishe.entity.UserAccount;
import com.bishe.entity.UserProfileDTO;
import com.bishe.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserAccountRepository userAccountRepository;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userAccountRepository);
    }

    @Test
    void registerShouldPersistUserWhenPayloadIsValid() {
        AuthRegisterRequest request = new AuthRegisterRequest();
        request.setUsername("tester01");
        request.setPassword("abc123");
        request.setDisplayName("测试用户");
        request.setPhone("13800138000");
        request.setEmail("tester@example.com");

        when(userAccountRepository.existsByUsername("tester01")).thenReturn(false);
        when(userAccountRepository.save(any(UserAccount.class))).thenAnswer(invocation -> {
            UserAccount account = invocation.getArgument(0);
            account.setId(10L);
            return account;
        });

        UserProfileDTO profile = authService.register(request);

        assertNotNull(profile);
        assertEquals(10L, profile.getId());
        assertEquals("tester01", profile.getUsername());
        assertEquals("测试用户", profile.getDisplayName());

        ArgumentCaptor<UserAccount> captor = ArgumentCaptor.forClass(UserAccount.class);
        verify(userAccountRepository).save(captor.capture());
        UserAccount saved = captor.getValue();
        assertEquals("tester01", saved.getUsername());
        assertNotEquals("abc123", saved.getPasswordHash());
        assertEquals("active", saved.getStatus());
        assertNotNull(saved.getCreatedAt());
        assertNotNull(saved.getLastLoginAt());
    }

    @Test
    void registerShouldRejectDuplicateUsername() {
        AuthRegisterRequest request = new AuthRegisterRequest();
        request.setUsername("tester01");
        request.setPassword("abc123");
        request.setDisplayName("测试用户");

        when(userAccountRepository.existsByUsername("tester01")).thenReturn(true);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> authService.register(request));
        assertEquals("用户名已存在", error.getMessage());
    }

    @Test
    void loginShouldReturnProfileWhenPasswordMatches() {
        AuthLoginRequest request = new AuthLoginRequest();
        request.setUsername("tester01");
        request.setPassword("abc123");

        UserAccount account = new UserAccount();
        account.setId(5L);
        account.setUsername("tester01");
        account.setPasswordHash("6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090");
        account.setDisplayName("测试用户");
        account.setStatus("active");
        account.setCreatedAt(LocalDateTime.now().minusDays(1));
        account.setLastLoginAt(LocalDateTime.now().minusHours(1));

        when(userAccountRepository.findByUsername("tester01")).thenReturn(Optional.of(account));
        when(userAccountRepository.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileDTO profile = authService.login(request);

        assertEquals(5L, profile.getId());
        assertEquals("tester01", profile.getUsername());
        verify(userAccountRepository).save(any(UserAccount.class));
    }

    @Test
    void loginShouldRejectInvalidPassword() {
        AuthLoginRequest request = new AuthLoginRequest();
        request.setUsername("tester01");
        request.setPassword("wrong123");

        UserAccount account = new UserAccount();
        account.setUsername("tester01");
        account.setPasswordHash("6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090");
        account.setStatus("active");

        when(userAccountRepository.findByUsername("tester01")).thenReturn(Optional.of(account));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> authService.login(request));
        assertEquals("用户不存在或密码错误", error.getMessage());
    }
}
