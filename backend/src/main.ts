import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const corsOriginEnv = process.env.CORS_ORIGIN;
  const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowedOrigins = corsOriginEnv
    ? corsOriginEnv
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : defaultOrigins;

  const allowAnyOrigin = allowedOrigins.includes('*');
  const allowNoOrigin = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return allowNoOrigin
          ? callback(null, true)
          : callback(new Error('CORS origin missing'), false);
      }
      if (allowAnyOrigin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: !allowAnyOrigin,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}
bootstrap();
