<!-- Các bảng -->
roles
permissions
role_permissions
users
students
teachers
secretaries
                    ┌──────────────┐
                    │    roles     │
                    └──────┬───────┘
                           │
                           │ role_id
                           ↓
                    ┌──────────────┐
                    │    users     │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
         students       teachers     secretaries


roles
  │
  └── role_permissions ─── permissions

