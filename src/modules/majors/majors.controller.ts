import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MajorsService } from './majors.service';
import { CreateMajorDto, UpdateMajorDto } from './dto/major.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ExcelService } from '../excel/excel.service';

@ApiTags('Majors')
@Controller('majors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MajorsController {
  constructor(
    private majorsService: MajorsService,
    private excelService: ExcelService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Create a new major' })
  async create(@Body() createDto: CreateMajorDto) {
    return this.majorsService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get all majors' })
  async findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(100), ParseIntPipe) take: number,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.majorsService.findAll({ skip, take, search, departmentId });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get major by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.majorsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Update major' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMajorDto,
  ) {
    return this.majorsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete major' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.majorsService.delete(id);
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import majors from Excel' })
  async importFromExcel(@UploadedFile() file: any) {
    const data = await this.excelService.parseExcel(file.buffer);
    const majorsData = data.map((row: any) => ({
      code: row['code'] || row['ma'] || '',
      name: row['name'] || row['ten'] || '',
      departmentCode: row['departmentcode'] || row['ma_khoa'] || '',
    }));
    return this.majorsService.importMajors(majorsData);
  }
}
