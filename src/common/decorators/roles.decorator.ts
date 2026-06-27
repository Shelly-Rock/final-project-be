import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './keys';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
