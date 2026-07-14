import { Post, Body, HttpCode, HttpStatus, Controller } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginReqDTO, LoginRespDTO } from './dto/login.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginReqDTO })
  @ApiOkResponse({ type: LoginRespDTO, description: 'Login successs' })
  async login(@Body() dto: LoginReqDTO): Promise<LoginRespDTO> {
    return this.authService.login(dto);
  }
}
