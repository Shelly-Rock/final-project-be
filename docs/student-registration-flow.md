# Student Account Registration Flow

## Overview

This document describes the student account registration flow implemented in the system.

## Flow Diagram

```
Secretary import danh sách Student
          │
          ↓
      students + users (password: 1111)
          │
          ├── username = student_id
          ├── email = Gmail sinh viên
          ├── password_hash = 1111 (default)
          ├── must_change_password = true
          ├── email_verified_at = NULL
          ├── is_active = true
          └── role_id = STUDENT
          │
          ↓
   Gửi email xác nhận
          │
          ↓
    Sinh viên click link
          │
          ↓
     Verify email
          │
          ├── email_verified_at = NOW()
          │
          ↓
     Đổi mật khẩu
          │
          ├── password_hash = mật khẩu mới
          └── must_change_password = false
          │
          ↓
         LOGIN
          │
          ↓
        JWT
```

## Database Changes

### New Table: `email_verification_tokens`

```sql
CREATE TABLE email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Updated User Fields (already existed)

| Field                | Type      | Description              |
| -------------------- | --------- | ------------------------ |
| email                | String    | Student's Gmail          |
| username             | String    | Student ID (e.g., SV001) |
| password_hash        | String    | Default: 1111            |
| must_change_password | Boolean   | Default: true            |
| email_verified_at    | DateTime? | NULL initially           |
| is_active            | Boolean   | Default: true            |
| role_id              | Int       | STUDENT role             |

## API Endpoints

### 1. Import Students

```
POST /students/import
- Secretary uploads Excel file
- Creates user accounts with default password
- Sends verification emails to all students
```

### 2. Verify Email

```
POST /auth/verify-email
Body: { token: "abc123xyz" }

- Validates token exists
- Checks token not expired
- Checks token not used
- Sets email_verified_at = NOW()
- Marks token as used
```

### 3. Change Password

```
POST /auth/change-password
Body: {
  token?: "abc123xyz",        // From email verification
  currentPassword?: "1111",   // Required if logged in
  newPassword: "newPassword123"
}

- Validates token or current password
- Updates password_hash
- Sets must_change_password = false
```

### 4. Login

```
POST /auth/login
Body: {
  username: "SV001",
  password: "newPassword123"
}

- Checks email_verified_at is set
- Validates password
- Checks must_change_password is false
- Returns JWT tokens
```

### 5. Resend Verification Email

```
POST /auth/resend-verification
Body: { email: "sv001@gmail.com" }

- Generates new verification token
- Sends new verification email
```

### 6. Get Current User

```
GET /auth/me
Headers: Authorization: Bearer <token>

- Returns current user info
```

## Email Template

When a student account is created, an email is sent with:

- **Subject**: Xác nhận Email - Hệ thống Quản lý Khóa luận
- **Content**:
  - Welcome message with student name
  - Default credentials info
  - Verification link button
  - 24-hour expiration notice
  - Note about password change requirement

## Security Considerations

1. **Token Expiration**: Verification tokens expire after 24 hours
2. **One-time Use**: Tokens can only be used once
3. **Password Hashing**: All passwords are hashed with bcrypt (salt rounds: 10)
4. **Default Password**: Initial password is `1111` (must be changed)
5. **Email Verification Required**: Cannot login until email is verified

## Environment Variables

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM="Thesis Management System <noreply@thesis.edu.vn>"

# App URLs
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

## Implementation Files

- `src/modules/auth/auth.service.ts` - Auth business logic
- `src/modules/auth/auth.controller.ts` - Auth API endpoints
- `src/modules/email/email.service.ts` - Email sending service
- `src/modules/student/services/student.create.service.ts` - Student creation with account setup
- `prisma/schema.prisma` - Database schema with email_verification_tokens
