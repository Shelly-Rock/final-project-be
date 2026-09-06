import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';

@ApiTags('Permissions')
@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách tất cả permissions (catalog)' })
  @ApiOkResponse({ description: 'Danh sách permissions' })
  async findAll() {
    const permissions = await this.permissionService.findAll();
    return {
      success: true,
      data: permissions,
      total: permissions.length,
    };
  }
}
