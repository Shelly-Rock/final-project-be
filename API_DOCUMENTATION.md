# Final Project API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Swagger UI
```
http://localhost:3000/api/docs
```

---

## Authentication Flow

### 1. Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "id": "clx1234567890",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx1234567890",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  }
}
```

### 3. Use Token
Include the token in all authenticated requests:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
---

## API Endpoints

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login and get token |

### Users Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/users` | Required | ADMIN | Get all users |
| GET | `/users/me` | Required | Any | Get current user |
| GET | `/users/:id` | Required | ADMIN | Get user by ID |
| PUT | `/users/:id` | Required | Any | Update user |
| DELETE | `/users/:id` | Required | ADMIN | Delete user |

### Health Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | Root health check |
| GET | `/health` | Public | Detailed health check |

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/register",
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "email must be an email" }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/users",
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/users",
  "message": "Forbidden resource"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/users/xyz",
  "message": "User with ID xyz not found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/register",
  "message": "Email already exists"
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/be_db"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="be_db"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="7d"

# App
PORT=3000
NODE_ENV="development"

# Security
BCRYPT_SALT_ROUNDS=10
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev --name init

# 5. Start development server
npm run start:dev

# 6. Open Swagger docs
# http://localhost:3000/api/docs
```
