package com.bishe.entity;

import lombok.Data;

@Data
public class AuthLoginRequest {
    private String username;
    private String password;
}
