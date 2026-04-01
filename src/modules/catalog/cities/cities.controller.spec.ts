// src/modules/catalog/cities/cities.controller.spec.ts
import { Test } from "@nestjs/testing";
import { CitiesController } from "./cities.controller";
import { CitiesService } from "./cities.service";

describe("CitiesController (unit)", () => {
  let controller: CitiesController;

  const citiesServiceMock = {
    listActive: jest.fn(),
    listByIds: jest.fn(),
    searchCities: jest.fn(),
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
        source: "manual_seed",
        sourceId: null,
        name: "Berlin",
        normalizedName: "berlin",
        i18n: { de: "Berlin", en: "Berlin" },
        countryCode: "DE",
        stateCode: "BE",
        stateName: "Berlin",
        districtName: null,
        postalCodes: ["10115"],
        population: 3669491,
        lat: null,
        lng: null,
        isActive: true,
        sortOrder: 1,
      },
    ]);

    const res = await controller.list({});

    expect(citiesServiceMock.listActive).toHaveBeenCalledWith(undefined, 50);
    expect(res).toEqual([
      {
        _id: "c1",
        key: "city_berlin",
        source: "manual_seed",
        sourceId: null,
        name: "Berlin",
        normalizedName: "berlin",
        i18n: { de: "Berlin", en: "Berlin" },
        countryCode: "DE",
        stateCode: "BE",
        stateName: "Berlin",
        districtName: null,
        postalCodes: ["10115"],
        population: 3669491,
        lat: null,
        lng: null,
        isActive: true,
        sortOrder: 1,
      },
    ]);
  });

  it("passes countryCode to service", async () => {
    citiesServiceMock.listActive.mockResolvedValue([]);
    await controller.list({ countryCode: "de", limit: 25 });
    expect(citiesServiceMock.listActive).toHaveBeenCalledWith("de", 25);
  });

  it("uses search flow when q is provided", async () => {
    citiesServiceMock.searchCities.mockResolvedValue([]);
    citiesServiceMock.listByIds.mockResolvedValue([]);

    await controller.list({ countryCode: "DE", q: "ber", limit: 8 });

    expect(citiesServiceMock.searchCities).toHaveBeenCalledWith("ber", 8, "DE");
    expect(citiesServiceMock.listActive).not.toHaveBeenCalled();
  });

  it("prepends explicitly requested ids and deduplicates results", async () => {
    citiesServiceMock.searchCities.mockResolvedValue([
      {
        _id: { toString: () => "c2" },
        key: "city_munich",
        source: "manual_seed",
        sourceId: null,
        name: "Munich",
        normalizedName: "munich",
        i18n: { de: "München", en: "Munich" },
        countryCode: "DE",
        stateCode: null,
        stateName: null,
        districtName: null,
        postalCodes: [],
        population: 1,
        lat: null,
        lng: null,
        isActive: true,
        sortOrder: 2,
      },
    ]);
    citiesServiceMock.listByIds.mockResolvedValue([
      {
        _id: { toString: () => "c1" },
        key: "city_berlin",
        source: "manual_seed",
        sourceId: null,
        name: "Berlin",
        normalizedName: "berlin",
        i18n: { de: "Berlin", en: "Berlin" },
        countryCode: "DE",
        stateCode: null,
        stateName: null,
        districtName: null,
        postalCodes: [],
        population: 1,
        lat: null,
        lng: null,
        isActive: true,
        sortOrder: 1,
      },
      {
        _id: { toString: () => "c2" },
        key: "city_munich",
        source: "manual_seed",
        sourceId: null,
        name: "Munich",
        normalizedName: "munich",
        i18n: { de: "München", en: "Munich" },
        countryCode: "DE",
        stateCode: null,
        stateName: null,
        districtName: null,
        postalCodes: [],
        population: 1,
        lat: null,
        lng: null,
        isActive: true,
        sortOrder: 2,
      },
    ]);

    const res = await controller.list({ ids: ["c1", "c2"], q: "mun", limit: 10 });

    expect(citiesServiceMock.listByIds).toHaveBeenCalledWith(["c1", "c2"], undefined);
    expect(res.map((item) => item._id)).toEqual(["c1", "c2"]);
  });

  it("uses ids-only flow without browse query when q is missing", async () => {
    citiesServiceMock.listByIds.mockResolvedValue([
      {
        _id: { toString: () => "c1" },
        key: "city_berlin",
        source: "manual_seed",
        sourceId: null,
        name: "Berlin",
        normalizedName: "berlin",
        i18n: { de: "Berlin", en: "Berlin" },
        countryCode: "DE",
        stateCode: null,
        stateName: null,
        districtName: null,
        postalCodes: [],
        population: 1,
        lat: null,
        lng: null,
        isActive: true,
        sortOrder: 1,
      },
    ]);

    const res = await controller.list({ ids: ["c1"], limit: 5 });

    expect(citiesServiceMock.listByIds).toHaveBeenCalledWith(["c1"], undefined);
    expect(citiesServiceMock.listActive).not.toHaveBeenCalled();
    expect(citiesServiceMock.searchCities).not.toHaveBeenCalled();
    expect(res.map((item) => item._id)).toEqual(["c1"]);
  });
});
