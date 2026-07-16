import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma/prisma.service';
import { LoginReqDTO, LoginRespDTO } from './dto/login.dto';
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    // private readonly jwtService: JwtService
  ) {}

  async login(dto: LoginReqDTO): Promise<LoginRespDTO> {
    return {} as LoginRespDTO;
  }
}
