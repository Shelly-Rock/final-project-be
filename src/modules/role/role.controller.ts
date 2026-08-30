import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RoleService } from './role.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  AssignUserRolesDto,
} from './dto';

@ApiTags('Roles')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo mới một role' })
  @ApiCreatedResponse({ type: RoleResponseDto, description: 'Role đã được tạo thành công' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.roleService.create(createRoleDto);
    return {
      success: true,
      message: 'Tạo role thành công',
      data: role,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách tất cả roles' })
  @ApiOkResponse({ type: [RoleResponseDto], description: 'Danh sách roles' })
  async findAll() {
    const roles = await this.roleService.findAll();
    return {
      success: true,
      data: roles,
      total: roles.length,
    };
  }

  @Get('all-with-deleted')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách tất cả roles (bao gồm đã xóa)' })
  @ApiOkResponse({ type: [RoleResponseDto], description: 'Danh sách roles' })
  async findAllWithDeleted() {
    const roles = await this.roleService.findAll({ includeDeleted: true });
    return {
      success: true,
      data: roles,
      total: roles.length,
    };
  }

  @Get('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách roles của user' })
  @ApiParam({ name: 'userId', description: 'ID của user', type: Number })
  async getUserRoles(@Param('userId', ParseIntPipe) userId: number) {
    const roles = await this.roleService.getUserRoles(userId);
    return {
      success: true,
      data: roles,
      total: roles.length,
    };
  }

  @Put('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gán nhiều roles cho user (thay thế toàn bộ)' })
  @ApiParam({ name: 'userId', description: 'ID của user', type: Number })
  async assignUserRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignUserRolesDto,
  ) {
    const roles = await this.roleService.assignUserRoles(userId, dto.role_ids);
    return {
      success: true,
      message: 'Gán roles cho user thành công',
      data: roles,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết role theo ID' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Chi tiết role' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const role = await this.roleService.findOne(id);
    return {
      success: true,
      data: role,
    };
  }

  @Get('name/:name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết role theo tên' })
  @ApiParam({ name: 'name', description: 'Tên của role', type: String })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Chi tiết role' })
  async findByName(@Param('name') name: string) {
    const role = await this.roleService.findByName(name);
    return {
      success: true,
      data: role,
    };
  }

  @Get(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách permissions của role' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  async getPermissions(@Param('id', ParseIntPipe) id: number) {
    const permissions = await this.roleService.getPermissions(id);
    return {
      success: true,
      data: permissions,
      total: permissions.length,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật thông tin role' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Role đã được cập nhật' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    const role = await this.roleService.update(id, updateRoleDto);
    return {
      success: true,
      message: 'Cập nhật role thành công',
      data: role,
    };
  }

  @Patch(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gán permissions cho role' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Permissions đã được gán' })
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body('permission_ids', ParseIntPipe) permissionIds: number[],
  ) {
    const role = await this.roleService.assignPermissions(id, permissionIds);
    return {
      success: true,
      message: 'Gán permissions thành công',
      data: role,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa role (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiQuery({ name: 'hardDelete', required: false, description: 'Xóa vĩnh viễn' })
  @ApiOkResponse({ description: 'Role đã được xóa' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('hardDelete') hardDelete?: string,
  ) {
    const isHardDelete = hardDelete === 'true' || hardDelete === '1';
    const result = await this.roleService.remove(id, isHardDelete);
    return {
      success: true,
      ...result,
    };
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Khôi phục role đã xóa' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Role đã được khôi phục' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    const role = await this.roleService.restore(id);
    return {
      success: true,
      message: 'Khôi phục role thành công',
      data: role,
    };
  }
}
