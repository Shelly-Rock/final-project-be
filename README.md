final-project-be/
│
├── src/
│   ├── main.ts                              # Entry point
│   ├── app.module.ts                        # Root module
│   │
│   ├── core/                                # CORE LAYER (Infrastructure)
│   │   ├── auth/                            # Authentication
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── permissions.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── refresh-token.strategy.ts
│   │   │   ├── decorators/
│   │   │   │   ├── public.decorator.ts
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── permissions.decorator.ts
│   │   │   ├── interfaces/
│   │   │   │   └── current-user.interface.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   ├── database/                        # Database Layer
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.service.ts
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma-metrics.service.ts
│   │   │   ├── repositories/                # Repository Pattern
│   │   │   │   ├── base.repository.ts
│   │   │   │   ├── user.repository.ts
│   │   │   │   └── employee.repository.ts
│   │   │   └── migrations/
│   │   │
│   │   ├── cache/                           # Caching Layer
│   │   │   ├── cache.module.ts
│   │   │   ├── cache.service.ts
│   │   │   ├── cache.interceptor.ts
│   │   │   └── cache.decorator.ts
│   │   │
│   │   ├── queue/                           # Queue Layer
│   │   │   ├── queue.module.ts
│   │   │   ├── queue.service.ts
│   │   │   ├── processors/
│   │   │   │   ├── email.processor.ts
│   │   │   │   └── report.processor.ts
│   │   │   └── queue.decorator.ts
│   │   │
│   │   ├── logging/                         # Logging Layer
│   │   │   ├── logger.module.ts
│   │   │   ├── logger.service.ts
│   │   │   ├── logger.interceptor.ts
│   │   │   └── winston.config.ts
│   │   │
│   │   ├── config/                          # Configuration
│   │   │   ├── config.module.ts
│   │   │   ├── database.config.ts
│   │   │   ├── jwt.config.ts
│   │   │   ├── redis.config.ts
│   │   │   ├── queue.config.ts
│   │   │   └── validation.config.ts
│   │   │
│   │   ├── exceptions/                      # Exception Handling
│   │   │   ├── exceptions.module.ts
│   │   │   ├── global-exception.filter.ts
│   │   │   ├── base.exception.ts
│   │   │   └── exceptions/
│   │   │       ├── not-found.exception.ts
│   │   │       ├── conflict.exception.ts
│   │   │       └── forbidden.exception.ts
│   │   │
│   │   ├── interceptors/                    # Global Interceptors
│   │   │   ├── transform.interceptor.ts
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── timeout.interceptor.ts
│   │   │   └── performance.interceptor.ts
│   │   │
│   │   ├── middlewares/                     # Middlewares
│   │   │   ├── cors.middleware.ts
│   │   │   ├── request-id.middleware.ts
│   │   │   └── rate-limit.middleware.ts
│   │   │
│   │   ├── pipes/                           # Global Pipes
│   │   │   ├── validation.pipe.ts
│   │   │   ├── parse-uuid.pipe.ts
│   │   │   └── parse-array.pipe.ts
│   │   │
│   │   ├── constants/                       # Global Constants
│   │   │   ├── roles.constant.ts
│   │   │   ├── permissions.constant.ts
│   │   │   └── status.constant.ts
│   │   │
│   │   ├── enums/                           # Global Enums
│   │   │   ├── roles.enum.ts
│   │   │   ├── permissions.enum.ts
│   │   │   └── status.enum.ts
│   │   │
│   │   ├── interfaces/                      # Global Interfaces
│   │   │   ├── paginated.interface.ts
│   │   │   ├── response.interface.ts
│   │   │   └── request.interface.ts
│   │   │
│   │   ├── utils/                           # Utility Functions
│   │   │   ├── code-generator.util.ts
│   │   │   ├── pagination.util.ts
│   │   │   ├── date.util.ts
│   │   │   └── crypto.util.ts
│   │   │
│   │   └── health/                          # Health Check
│   │       ├── health.module.ts
│   │       └── health.controller.ts
│   │
│   ├── modules/                             # FEATURE MODULES (Business Logic)
│   │   │
│   │   ├── employee/                        # Employee Module
│   │   │   ├── employee.module.ts
│   │   │   ├── employee.controller.ts
│   │   │   ├── employee.service.ts
│   │   │   ├── employee-position.service.ts
│   │   │   ├── employee-validator.service.ts
│   │   │   │
│   │   │   ├── dto/
│   │   │   │   ├── request/
│   │   │   │   │   ├── create-employee.dto.ts
│   │   │   │   │   ├── update-employee.dto.ts
│   │   │   │   │   ├── list-employee-query.dto.ts
│   │   │   │   │   ├── assign-department.dto.ts
│   │   │   │   │   ├── assign-team.dto.ts
│   │   │   │   │   ├── assign-position.dto.ts
│   │   │   │   │   ├── change-position.dto.ts
│   │   │   │   │   └── remove-position.dto.ts
│   │   │   │   └── response/
│   │   │   │       ├── employee-response.dto.ts
│   │   │   │       └── employee-position-response.dto.ts
│   │   │   │
│   │   │   ├── entities/
│   │   │   │   └── employee.entity.ts
│   │   │   │
│   │   │   ├── interfaces/
│   │   │   │   ├── employee.interface.ts
│   │   │   │   └── employee-position.interface.ts
│   │   │   │
│   │   │   ├── constants/
│   │   │   │   └── employee.constant.ts
│   │   │   │
│   │   │   ├── enums/
│   │   │   │   └── employee-status.enum.ts
│   │   │   │
│   │   │   ├── guards/
│   │   │   │   └── employee-owner.guard.ts
│   │   │   │
│   │   │   ├── decorators/
│   │   │   │   └── current-employee.decorator.ts
│   │   │   │
│   │   │   └── tests/
│   │   │       ├── unit/
│   │   │       │   ├── employee.service.spec.ts
│   │   │       │   └── employee-position.service.spec.ts
│   │   │       └── e2e/
│   │   │           └── employee.e2e-spec.ts
│   │   │
│   │   ├── user/                            # User Module
│   │   │   ├── user.module.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── request/
│   │   │   │   │   ├── create-user.dto.ts
│   │   │   │   │   └── update-user.dto.ts
│   │   │   │   └── response/
│   │   │   │       └── user-response.dto.ts
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts
│   │   │   └── tests/
│   │   │
│   │   ├── role/                            # Role Module
│   │   │   ├── role.module.ts
│   │   │   ├── role.controller.ts
│   │   │   ├── role.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── permission/                      # Permission Module
│   │   │   ├── permission.module.ts
│   │   │   ├── permission.service.ts
│   │   │   └── permission.seeder.ts
│   │   │
│   │   └── [other-modules]/                 # Other Feature Modules
│   │
│   ├── shared/                              # SHARED LAYER
│   │   ├── dto/
│   │   │   └── pagination.dto.ts
│   │   ├── interfaces/
│   │   │   └── paginated-result.interface.ts
│   │   ├── utils/
│   │   │   ├── code-generator.util.ts
│   │   │   ├── pagination.util.ts
│   │   │   └── response.util.ts
│   │   └── validators/
│   │       └── custom.validators.ts
│   │
│   └── common/                              # COMMON LAYER (Deprecated - use core)
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── .dockerignore
│
├── scripts/
│   ├── deploy.sh
│   ├── seed.sh
│   └── migrate.sh
│
├── logs/                                    # Log files (git ignored)
│   ├── app.log
│   ├── error.log
│   └── access.log
│
├── .env.example
├── .env
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.build.json
└── README.md





Nguyên tắc build hệ thống

Infrastructure → Core foundation → Shared contract → Feature modules → Cross-cutting enhancement


main.ts
API prefix → chia version API (/api/v1)
CORS → cho frontend khác domain gọi API
ValidationPipe → check input data
ExceptionFilter → chuẩn hoá lỗi
Interceptor → xử lý “trước & sau request”
Swagger → tài liệu API tự động

-> CẦN BỔ SUNG SAU:
Logging interceptor
Helmet
Rate limit (ThrottlerModule)
Versioning API