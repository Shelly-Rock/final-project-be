@ApiTags('Authentication') Nhóm các API vào mục Authentication trong Swagger.
@ApiOperation({...}) Mô tả endpoint đang làm gì (summary, description).
@ApiBody({...}) Khai báo kiểu dữ liệu của request body (DTO nhận vào).
@ApiOkResponse({...}) Mô tả response thành công (thường HTTP 200), bao gồm DTO trả về và mô tả.
@ApiUnauthorizedResponse({...}) Mô tả response khi xảy ra lỗi 401 Unauthorized.
@ApiBearerAuth() Đánh dấu endpoint cần Bearer Token trong Swagger, hiển thị nút Authorize để nhập JWT.
