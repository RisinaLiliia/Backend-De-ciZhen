// src/modules/catalog/cities/cities.service.spec.ts
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { CitiesService } from "./cities.service";
import { City } from "./schemas/city.schema";

describe("CitiesService", () => {
  let service: CitiesService;

  const modelMock = {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const chain = {
    sort: jest.fn(),
    limit: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    modelMock.find.mockReturnValue(chain);
    chain.sort.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CitiesService,
        { provide: getModelToken(City.name), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(CitiesService);
  });

  it("listActive filters by isActive=true and sorts", async () => {
    chain.exec.mockResolvedValue([{ _id: "1", name: "Berlin", countryCode: "DE", isActive: true }]);

    await service.listActive();

    expect(modelMock.find).toHaveBeenCalledWith({ isActive: true });
    expect(chain.sort).toHaveBeenCalledWith({ sortOrder: 1, population: -1, "i18n.en": 1, name: 1 });
  });

  it("listActive normalizes countryCode to uppercase", async () => {
    chain.exec.mockResolvedValue([]);

    await service.listActive("de");

    expect(modelMock.find).toHaveBeenCalledWith({ isActive: true, countryCode: "DE" });
  });

  it("listActive applies a safe limit when requested", async () => {
    chain.exec.mockResolvedValue([]);

    await service.listActive("de", 999);

    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it("listByIds returns only requested active cities", async () => {
    chain.exec.mockResolvedValue([{ _id: "c1" }]);

    const result = await service.listByIds([" c1 ", "", "c2", "c1"], "de");

    expect(modelMock.find).toHaveBeenCalledWith({
      isActive: true,
      countryCode: "DE",
      _id: { $in: ["c1", "c2"] },
    });
    expect(result).toEqual([{ _id: "c1" }]);
  });

  it("resolveActivityCoords returns catalog coordinates when present", async () => {
    chain.exec.mockResolvedValue([
      {
        _id: { toString: () => "c1" },
        key: "city_berlin",
        name: "Berlin",
        i18n: { de: "Berlin" },
        countryCode: "DE",
        lat: 52.52,
        lng: 13.405,
      },
    ]);

    const result = await service.resolveActivityCoords([
      { cityId: "c1", citySlug: "berlin", cityName: "Berlin", countryCode: "de" },
    ]);

    expect(modelMock.find).toHaveBeenCalledWith({ countryCode: "DE" });
    expect(result.get("berlin")).toEqual({
      cityId: "c1",
      lat: 52.52,
      lng: 13.405,
    });
  });

  it("resolveActivityCoords falls back to built-in geo map when catalog coords are missing", async () => {
    chain.exec.mockResolvedValue([
      {
        _id: { toString: () => "c2" },
        key: "city_mannheim",
        name: "Mannheim",
        i18n: { de: "Mannheim" },
        countryCode: "DE",
        lat: null,
        lng: null,
      },
    ]);

    const result = await service.resolveActivityCoords([
      { cityId: "c2", citySlug: "mannheim", cityName: "Mannheim", countryCode: "DE" },
    ]);

    expect(result.get("mannheim")).toEqual({
      cityId: "c2",
      lat: 49.4875,
      lng: 8.466,
    });
  });

  it("resolveCityByName matches normalized names", async () => {
    modelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: "c1", normalizedName: "freiburg im breisgau" }),
    });

    const result = await service.resolveCityByName("Freiburg im Breisgau", "de");

    expect(modelMock.findOne).toHaveBeenCalledWith({
      isActive: true,
      countryCode: "DE",
      $or: [
        { normalizedName: "freiburg im breisgau" },
        { normalizedAliases: "freiburg im breisgau" },
        { key: "freiburg_im_breisgau" },
      ],
    });
    expect(result).toEqual({ _id: "c1", normalizedName: "freiburg im breisgau" });
  });

  it("searchCities uses normalized prefix matching", async () => {
    chain.exec.mockResolvedValue([{ _id: "c1", normalizedName: "baden baden" }]);

    const result = await service.searchCities("Baden", 5, "de");

    expect(modelMock.find).toHaveBeenCalledWith({
      isActive: true,
      countryCode: "DE",
      $or: [
        { normalizedName: /^baden/i },
        { normalizedAliases: /^baden/i },
      ],
    });
    expect(chain.sort).toHaveBeenCalledWith({ sortOrder: 1, population: -1, normalizedName: 1 });
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual([{ _id: "c1", normalizedName: "baden baden" }]);
  });

  it("getNearbyCities queries by 2dsphere location", async () => {
    modelMock.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: "c1",
        location: { type: "Point", coordinates: [8.4037, 49.0069] },
      }),
    });
    chain.exec.mockResolvedValue([{ _id: "c2" }]);

    const result = await service.getNearbyCities({ cityId: "c1", radiusKm: 50, countryCode: "de", limit: 3 });

    expect(modelMock.find).toHaveBeenCalledWith({
      isActive: true,
      _id: { $ne: "c1" },
      countryCode: "DE",
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [8.4037, 49.0069] },
          $maxDistance: 50000,
        },
      },
    });
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(result).toEqual([{ _id: "c2" }]);
  });
});
