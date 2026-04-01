// src/main.ts
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RolesGuard } from "./modules/auth/guards/roles.guard";
import { Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { RequestLoggingMiddleware } from "./common/middleware/request-logging.middleware";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  const isProd = config.get<string>("app.nodeEnv") === "production";
  const swaggerEnabled = config.get<boolean>("app.swaggerEnabled") ?? !isProd;
  const swaggerPath = config.get<string>("app.swaggerPath") ?? "docs";
  const trustProxyRaw = String(config.get<string | number | boolean>("app.trustProxy") ?? "0").trim();
  const trustProxyLower = trustProxyRaw.toLowerCase();
  if (trustProxyLower === "true") {
    app.set("trust proxy", true);
  } else if (trustProxyLower === "false") {
    app.set("trust proxy", false);
  } else if (/^\d+$/.test(trustProxyRaw)) {
    app.set("trust proxy", Number(trustProxyRaw));
  } else {
    app.set("trust proxy", trustProxyRaw);
  }

  const requestIdMiddlewareInstance = new RequestIdMiddleware();
  app.use(requestIdMiddlewareInstance.use.bind(requestIdMiddlewareInstance));
  const requestLoggingMiddlewareInstance = new RequestLoggingMiddleware();
  app.use(requestLoggingMiddlewareInstance.use.bind(requestLoggingMiddlewareInstance));

  app.use(helmet());
  app.use(cookieParser());

  const configuredOrigins = (config.get<string[]>("app.allowedOrigins") ?? []).filter(Boolean);
  const frontendUrl = config.get<string>("app.frontendUrl");
  const devLocalOrigins = isProd ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"];
  const origins = Array.from(
    new Set([...(configuredOrigins ?? []), ...(frontendUrl ? [frontendUrl] : []), ...devLocalOrigins]),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(null, false);
    },
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

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("De’ciZhen API")
      .setDescription("Interactive API documentation")
      .setVersion("1.0.0")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
      .addCookieAuth(
        "refreshToken",
        {
          type: "apiKey",
          in: "cookie",
          name: "refreshToken",
        },
        "refreshToken",
      )
      .addSecurityRequirements("access-token")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger docs enabled at /${swaggerPath}`);
  } else {
    logger.log("Swagger docs disabled for this runtime");
  }


  const port = Number(process.env.PORT ?? config.get<number>("app.port") ?? 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 Server running on port ${port}`);

}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
