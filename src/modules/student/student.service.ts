import {Injectable} from "@nestjs/common";
import {ExcelService} from "@/shared/utils";
import {PrismaService} from "@/core/database/prisma/prisma.service";
@Injectable()
export class StudentService{
    constructor (
        private readonly prismaService : PrismaService,
        private readonly  excelService  : ExcelService
    ){}
}