

Muốn tất cả API đều thành

{
    "success":true,
    "message":"Success",
    "data":{
        "importedCount":120
    }
}

thì phải thêm

ResponseInterceptor
Kiến trúc chuẩn
Controller
      │
      ▼
Service
      │
      ▼
return { importedCount:120 }
      │
      ▼
ResponseInterceptor
      │
      ▼
{
    success:true,
    message:"Success",
    data:{
        importedCount:120
    }
}

Khi lỗi

throw BadRequestException
      │
      ▼
AllExceptionsFilter
      │
      ▼
{
    success:false,
    message:"...",
    errors:[...]
}