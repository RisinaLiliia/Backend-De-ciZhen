import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { City, type CityDocument } from '../modules/catalog/cities/schemas/city.schema';
import { GEO_NAMES_DE_STATE_LABELS, withMongoRetry } from './import-geonames-cities';

export async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const cityModel = app.get<Model<CityDocument>>(getModelToken(City.name));

  try {
    let matched = 0;
    let modified = 0;

    for (const [stateCode, stateName] of Object.entries(GEO_NAMES_DE_STATE_LABELS)) {
      const result = await withMongoRetry(
        `update state labels for ${stateCode}`,
        () =>
          cityModel
            .updateMany(
              {
                countryCode: 'DE',
                stateCode,
                stateName: { $ne: stateName },
              },
              {
                $set: { stateName },
              },
            )
            .exec(),
        {
          attempts: 5,
          baseDelayMs: 1000,
        },
      );

      matched += result.matchedCount ?? 0;
      modified += result.modifiedCount ?? 0;
      console.log(`… state ${stateCode} => ${stateName}: matched=${result.matchedCount ?? 0} modified=${result.modifiedCount ?? 0}`);
    }

    console.log(`✅ City state label migration completed. matched=${matched} modified=${modified}`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('❌ City state label migration failed', error);
    process.exit(1);
  });
}
