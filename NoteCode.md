Bước 1. Inject dependency
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma/prisma.service';
import { ExcelService } from '@shared/utils/excel/excel.service';

@Injectable()
export class StudentService {
constructor(
private readonly prisma: PrismaService,
private readonly excelService: ExcelService,
) {}
}
Bước 2. Tạo method
async importStudents(file: MulterFile) {

}

Hiện tại để trống.

Bước 3. Đọc Workbook

Đây chính là hàm chúng ta vừa viết.

const workbook = await this.excelService.readWorkbook(file.buffer);
Bước 4. Lấy Worksheet
const worksheet = this.excelService.getWorksheet(workbook);
Bước 5. Lấy Header
const headers = this.excelService.getHeaders(worksheet);
Bước 6. Header chuẩn

Ví dụ:

const expectedHeaders = [
'student_code',
'full_name',
'email',
'class_name',
];

Sau này bạn có thể đưa nó sang student.constant.ts.

Bước 7. Validate Header
this.excelService.validateHeaders(
headers,
expectedHeaders,
);

Nếu thiếu header

↓

ExcelService sẽ throw luôn

↓

Service không cần xử lý nữa.

Bước 8. Parse Excel

Ví dụ DTO

export class ImportStudentExcelDto {
student_code: string;

full_name: string;

email: string;

class_name: string;
}

Sau đó

const students =
this.excelService.parseRows<ImportStudentExcelDto>(
worksheet,
headers,
);

Lúc này

students

sẽ có dạng

[
{
student_code: "20522001",
full_name: "Nguyen Van A",
email: "a@gmail.com",
class_name: "CNTT1"
},
{
student_code: "20522002",
full_name: "Nguyen Van B",
email: "b@gmail.com",
class_name: "CNTT1"
}
]
Đến đây service sẽ là
async importStudents(file: MulterFile) {
const workbook = await this.excelService.readWorkbook(file.buffer);

const worksheet = this.excelService.getWorksheet(workbook);

const headers = this.excelService.getHeaders(worksheet);

const expectedHeaders = [
'student_code',
'full_name',
'email',
'class_name',
];

this.excelService.validateHeaders(
headers,
expectedHeaders,
);

const students =
this.excelService.parseRows<ImportStudentExcelDto>(
worksheet,
headers,
);
}

Đây là giai đoạn "đọc và chuyển Excel → Object". Chưa có dòng nào thao tác với database.

Bước tiếp theo (rất quan trọng)

Sau khi có students, đừng createMany() ngay.

Nên xử lý theo thứ tự:

Validate từng dòng (MSSV, email, họ tên...)
Kiểm tra dữ liệu trùng trong chính file Excel.
Kiểm tra MSSV/email đã tồn tại trong database.
Mapping sang model Prisma.
prisma.$transaction(...).
createMany().
Trả về kết quả import (bao nhiêu dòng thành công, bao nhiêu dòng lỗi).

Đây là luồng mà các hệ thống import dữ liệu thực tế thường áp dụng.
