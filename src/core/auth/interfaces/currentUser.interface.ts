// ============================================================
// JwtUser — shape của payload JWT sau khi JwtStrategy.validate()
// trả về nguyên văn. Actor id luôn lấy từ đây (@CurrentUser('sub')),
// KHÔNG nhận từ request body.
// ============================================================

export interface JwtUser {
  /** id của users */
  sub: number;
  email: string;
  /** role đang active */
  role: string;
  /** toàn bộ role tài khoản đang có */
  roles: string[];
}
