1. Database Schema (prisma/schema.prisma)
Thêm bảng EmailVerificationToken để quản lý email verification
Đã push lên database thành công
2. Auth Module (src/modules/auth/)
auth.dto.ts - Các DTOs mới: login, verify-email, change-password, resend-verification
auth.service.ts - Logic xử lý:
login() - Đăng nhập (yêu cầu email đã verify + password đã đổi)
verifyEmail() - Xác nhận email từ link
changePassword() - Đổi mật khẩu (với token hoặc current password)
resendVerification() - Gửi lại email verification
sendVerificationEmailToUser() - Gửi email cho sinh viên mới
createStudentAccount() - Tạo tài khoản sinh viên
auth.controller.ts - Các endpoints:
POST /auth/login
POST /auth/verify-email
POST /auth/change-password
POST /auth/change-password/me
POST /auth/resend-verification
GET /auth/me
3. Email Module (src/modules/email/)
email.service.ts - Gửi email với template HTML đẹp
email.module.ts - Global module
4. Student Module (src/modules/student/)
student.create.service.ts - Khi import sinh viên:
Tạo user với password mặc định 1111
Gửi email verification tự động
5. Configuration
mail.config.ts - Email configuration
.env - Thêm email environment variables
Flow hoàn chỉnh
Secretary import Excel
       ↓
Tạo user + student với password "1111"
       ↓
Gửi email xác nhận tự động
       ↓
Sinh viên click link trong email
       ↓
Verify email (email_verified_at = NOW)
       ↓
Đổi mật khẩu (must_change_password = false)
       ↓
Đăng nhập với password mới → JWT
API Documentation
Chi tiết đã được viết trong docs/student-registration-flow.md