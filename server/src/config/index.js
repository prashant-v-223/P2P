export const config = {
  port: Number(process.env.PORT) || 5050,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'rayzon_access_token_secret_15m_2026',
  jwtAccessExpiresIn: '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'rayzon_refresh_token_secret_7d_2026',
  jwtRefreshExpiresIn: '7d',
  environment: process.env.NODE_ENV || 'development',
  mail: {
    enabled: !true,
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    username: process.env.MAIL_USERNAME,
    password: process.env.MAIL_PASSWORD,
    fromAddress: process.env.MAIL_FROM_ADDRESS || 'noreply@rayzonsolar.one',
    fromName: process.env.MAIL_FROM_NAME || 'Rayzon P2P'
  }
};
