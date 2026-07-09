Thiết kế Database (schema.prisma) ⭐⭐⭐⭐⭐

        │

        ▼

Prisma Generate

        │

        ▼

UserService

        │

        ▼

       DTO

        │

        ▼

    Validator

        │

        ▼

    Controller

        │

        ▼

    UserModule

        │

        ▼

       Auth





Nguyên tắc thiết kế 1 entity:

prisma/
└── schema.prisma
        │
        ▼
model User
        │
        ▼
npx prisma generate
        │
        ▼
Prisma Client
        │
        ▼
UserService



Database
        │
        ▼
Entity -> đại diện cho bussiness object
        │
        ▼
DTO    -> định đạng response cần trả về (chỉ trả về 1 phần ko phải tất cả)
        │
        ▼
JSON Response




