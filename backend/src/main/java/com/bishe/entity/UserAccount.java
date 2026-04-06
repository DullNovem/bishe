package com.bishe.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_account")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 64, nullable = false, unique = true)
    private String username;

    @Column(length = 128, nullable = false)
    private String passwordHash;

    @Column(length = 64, nullable = false)
    private String displayName;

    @Column(length = 64)
    private String phone;

    @Column(length = 128)
    private String email;

    @Column(length = 16, nullable = false)
    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime lastLoginAt;
}
