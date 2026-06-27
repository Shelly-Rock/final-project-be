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
import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ExcelService } from '../excel/excel.service';

@ApiTags('Classes')
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(
    private classesService: ClassesService,
    private excelService: ExcelService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Create a new class' })
  async create(@Body() createDto: CreateClassDto) {
    return this.classesService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get all classes' })
  async findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(100), ParseIntPipe) take: number,
    @Query('search') search?: string,
    @Query('majorId') majorId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.classesService.findAll({ skip, take, search, majorId, courseId });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get class by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Update class' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateClassDto) {
    return this.classesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete class' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.classesService.delete(id);
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import classes from Excel' })
  async importFromExcel(@UploadedFile() file: any) {
    const data = await this.excelService.parseExcel(file.buffer);
    const classesData = data.map((row: any) => ({
      code: row['code'] || row['ma'] || '',
      name: row['name'] || row['ten'] || '',
      majorCode: row['majorcode'] || row['ma_nganh'] || '',
      courseCode: row['coursecode'] || row['ma_khoa'] || '',
    }));
    return this.classesService.importClasses(classesData);
  }
}
