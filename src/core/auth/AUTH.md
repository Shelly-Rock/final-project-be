src/
├── config/
│ └── jwt.config.ts  
│
├── auth/
│ ├── decorators/ -> Tạo các custom decorator như @CurrentUser(), @Roles(), @Permissions(), @Public().
| | |**currentUser.decorator.ts/ -> Sau khi strategory chạy currentUser lấy nó  
| | |**permissions.decorator.ts/ -> @Permissions("course.create") lưu metada -> Guard đọc meta-data này
| | |**public.decorator.ts/ -> JwtGuard bảo vệ tất cả, ngoại trừ login đánh dươc đánh dấu @Public()
│ ├── guards/ -> Kiểm tra request có được phép thực thi hay không (JWT, Role, Permission).
| | |**jwtAuth.guard.ts/ -> Kiểm tra có Authorization Header không?
| | |**permissions.guard/ -> Kiểm tra permission của user
| | |**roles.guard.ts/ -> Sau khi có req user kiểm tra role
│ ├── interfaces/ -> Chứa các kiểu dữ liệu (TypeScript interface/type) dùng chung trong module auth.
│ ├── strategies/ -> Định nghĩa cách xác thực
| | |** jwt.strategy.ts/ -> Request JWT có hợp lệ không : JWT strategy -> Verify Secret -> Decode
| | |** refreshToken.strategy.ts/ -> hoạt động như strategy nhưng đóng vai trò refresh token
| |
│ └── auth.module.ts/ Đăng ký và kết nối tất cả các thành phần của module Auth (Strategy, Guard, Passport, JwtModule, ...).
