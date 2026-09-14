import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
// PassportStrategy -> dùng để tích hợp Passport, đăng ký strategy vào DI của Nest.js
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
// ExtractJwt -> dùng để lấy Jwt từ request ( lấy token từ Header,Cookie, Query String)
// Strategy -> dùng để nhận token, verify chữ ký, decode payload

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.access.secret'),
    });
  }

  async validate(payload: any) {
    // JWT `sub` is often a string after decode; role casing can also differ
    // from the DB (`teacher` vs `TEACHER`). Normalize so RolesGuard and
    // @CurrentUser('sub') always see an integer id and uppercase role.
    const sub = Number(payload?.sub ?? payload?.id);
    const role = String(payload?.role ?? '')
      .trim()
      .toUpperCase();
    const roles = Array.isArray(payload?.roles)
      ? payload.roles.map((item: unknown) => String(item).trim().toUpperCase())
      : payload?.roles;

    return {
      ...payload,
      sub,
      id: Number.isInteger(sub) ? sub : payload?.id,
      role,
      roles,
    };
  }
}
