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
  const allowMissingOrigin = process.env.NODE_ENV !== 'production';

  if (allowAnyOrigin && process.env.NODE_ENV === 'production') {
    console.warn(
      'CORS_ORIGIN is set to "*"; this permits any origin and weakens CORS protection in production.',
    );
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        if (allowMissingOrigin) return callback(null, true);
        return callback(
          new Error(
            'CORS request rejected: Origin header is required in production',
          ),
          false,
        );
      }
      if (allowAnyOrigin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(
        new Error(
          `CORS request blocked: Origin ${origin} is not in the allowed origins list`,
        ),
        false,
      );
    },
    // When allowing any origin, credentials must be disabled per CORS spec.
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
