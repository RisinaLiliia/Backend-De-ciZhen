// src/database/seeds/seed-cities.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { City, CityDocument } from "../../modules/catalog/cities/schemas/city.schema";

const CITIES: Array<Pick<City, "name" | "countryCode" | "sortOrder">> = [
  { name: "Berlin", countryCode: "DE", sortOrder: 1 },
  { name: "Hamburg", countryCode: "DE", sortOrder: 2 },
  { name: "Munich", countryCode: "DE", sortOrder: 3 },
  { name: "Karlsruhe", countryCode: "DE", sortOrder: 4 },
  { name: "Baden-Baden", countryCode: "DE", sortOrder: 5 },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));

  console.log("🌱 Seeding cities...");

  for (const city of CITIES) {
    const exists = await cityModel.findOne({
      name: city.name,
      countryCode: city.countryCode,
    });

    if (exists) {
      console.log(`↺ ${city.name} already exists — skipped`);
      continue;
    }

    await cityModel.create({
      name: city.name,
      countryCode: city.countryCode,
      sortOrder: city.sortOrder,
      isActive: true,
    });

    console.log(`✓ ${city.name} inserted`);
  }

  await app.close();
  console.log("✅ Cities seed completed");
}

bootstrap().catch((err) => {
  console.error("❌ Cities seed failed", err);
  process.exit(1);
});
