// src/swagger.ts
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { SwaggerAppModule } from "./swagger/swagger.module";
import { writeFileSync } from "fs";

async function generateSwagger() {
  const app = await NestFactory.create(SwaggerAppModule);

  const config = new DocumentBuilder()
    .setTitle("Decide API")
    .setDescription("API documentation")
    .setVersion("1.0.0")
    .addServer("https://backend-de-cizhen.onrender.com", "Production")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      "access-token",
    )
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
    .setLicense("MIT", "https://opensource.org/licenses/MIT")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  writeFileSync("./swagger.json", JSON.stringify(document, null, 2));

  await app.close();
  console.log("✅ swagger.json generated");
}

void (async () => {
  await generateSwagger();
})();
