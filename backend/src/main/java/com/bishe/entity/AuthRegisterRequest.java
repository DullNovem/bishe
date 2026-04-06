package com.bishe.entity;

import lombok.Data;

@Data
public class AuthRegisterRequest {
    private String username;
    private String password;
    private String displayName;
    private String phone;
    private String email;
}
