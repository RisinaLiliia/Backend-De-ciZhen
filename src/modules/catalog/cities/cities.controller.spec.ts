// src/modules/catalog/cities/cities.controller.spec.ts
import { Test } from "@nestjs/testing";
import { CitiesController } from "./cities.controller";
import { CitiesService } from "./cities.service";

describe("CitiesController (unit)", () => {
  let controller: CitiesController;

  const citiesServiceMock = {
    listActive: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [CitiesController],
      providers: [{ provide: CitiesService, useValue: citiesServiceMock }],
    }).compile();

    controller = moduleRef.get(CitiesController);
  });

  it("returns mapped dto list", async () => {
    citiesServiceMock.listActive.mockResolvedValue([
      {
        _id: { toString: () => "c1" },
        key: "city_berlin",
        name: "Berlin",
        i18n: { de: "Berlin", en: "Berlin" },
        countryCode: "DE",
        isActive: true,
        sortOrder: 1,
      },
    ]);

    const res = await controller.list(undefined);

    expect(citiesServiceMock.listActive).toHaveBeenCalledWith(undefined);
    expect(res).toEqual([
      {
        _id: "c1",
        key: "city_berlin",
        name: "Berlin",
        i18n: { de: "Berlin", en: "Berlin" },
        countryCode: "DE",
        isActive: true,
        sortOrder: 1,
      },
    ]);
  });

  it("passes countryCode to service", async () => {
    citiesServiceMock.listActive.mockResolvedValue([]);
    await controller.list("de");
    expect(citiesServiceMock.listActive).toHaveBeenCalledWith("de");
  });
});
