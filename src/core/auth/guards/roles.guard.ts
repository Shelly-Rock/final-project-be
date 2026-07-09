/* Vấn đề cần giải quyết */
// Làm sao để hệ thống biết token JWT có hợp lệ không?
// Làm sao để giải mã token và lấy thông tin user?

/* File này làm gì? */
// Xác thực token JWT từ header Authorization
// Giải mã token bằng JWT_SECRET
// Trả về user object để gắn vào request

/* Luồng hoạt động */
// Client gửi request → JwtStrategy → Verify Secret → Decode token → Trả về user → request.user

/* Ai gọi nó? */
// JwtAuthGuard gọi nó khi có request cần xác thực
// Passport tự động gọi khi sử dụng AuthGuard('jwt')

/* Nó gọi ai? */
// ConfigService để lấy JWT_SECRET
// UserService để kiểm tra user có tồn tại không (tuỳ chọn)
