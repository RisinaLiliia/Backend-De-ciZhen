import { model, models } from "mongoose";

import { City, CitySchema } from "./city.schema";

describe("CitySchema", () => {
  const modelName = "CitySchemaSpec";
  const CityModel = models[modelName] ?? model(modelName, CitySchema);

  afterAll(() => {
    delete models[modelName];
  });

  it("preserves GeoJSON point coordinates on cast", () => {
    const doc = new CityModel({
      key: "zwoenitz",
      source: "geonames",
      sourceId: "2803476",
      name: "Zwönitz",
      normalizedName: "zwoenitz",
      aliases: ["Zwönitz", "Zwoenitz"],
      normalizedAliases: ["zwoenitz"],
      i18n: { de: "Zwönitz", en: "Zwoenitz" },
      countryCode: "DE",
      lat: 50.63027,
      lng: 12.80999,
      location: {
        type: "Point",
        coordinates: [12.80999, 50.63027],
      },
      isActive: true,
      sortOrder: 999,
    });

    expect(doc.location).toEqual({
      type: "Point",
      coordinates: [12.80999, 50.63027],
    });
  });
});
