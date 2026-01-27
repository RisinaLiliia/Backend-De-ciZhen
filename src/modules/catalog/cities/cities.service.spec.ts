// src/modules/catalog/cities/cities.service.spec.ts
import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { CitiesService } from "./cities.service";
import { City } from "./schemas/city.schema";

describe("CitiesService", () => {
  let service: CitiesService;

  const modelMock = {
    find: jest.fn(),
  };

  const chain = {
    sort: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    modelMock.find.mockReturnValue(chain);
    chain.sort.mockReturnValue(chain);

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
    expect(chain.sort).toHaveBeenCalledWith({ sortOrder: 1, name: 1 });
  });

  it("listActive normalizes countryCode to uppercase", async () => {
    chain.exec.mockResolvedValue([]);

    await service.listActive("de");

    expect(modelMock.find).toHaveBeenCalledWith({ isActive: true, countryCode: "DE" });
  });
});
