process.env.MONGOMS_IP = '127.0.0.1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3001';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_min_32_chars_value';
process.env.REDIS_DISABLED = process.env.REDIS_DISABLED || 'true';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
