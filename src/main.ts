// src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RolesGuard } from "./modules/auth/guards/roles.guard";
import { Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const isProd = config.get<string>("app.nodeEnv") === "production";

  const requestIdMiddlewareInstance = new RequestIdMiddleware();
  app.use(requestIdMiddlewareInstance.use.bind(requestIdMiddlewareInstance));

  app.use(helmet());
  app.use(cookieParser());

  const origins = (config.get<string[]>("app.allowedOrigins") ?? []).filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalGuards(new RolesGuard(app.get(Reflector)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(!isProd));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("De’ciZhen API")
    .setDescription("Interactive API documentation")
    .setVersion("1.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });


  const port = Number(process.env.PORT ?? config.get<number>("app.port") ?? 3000);
await app.listen(port, "0.0.0.0");
console.log(`🚀 Server running on port ${port}`);

}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
