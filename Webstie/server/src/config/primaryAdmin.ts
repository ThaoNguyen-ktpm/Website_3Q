// Theo yêu cầu của Bảo: Admin chính cố định trong code, không lưu DB hay .env.
export const PRIMARY_ADMIN_EMAIL = 'nvthao.12a5.20@gmail.com';

export const isPrimaryAdmin = (email: string | undefined): boolean =>
  email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
