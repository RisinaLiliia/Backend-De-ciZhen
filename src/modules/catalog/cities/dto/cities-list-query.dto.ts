import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

function normalizeIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item ?? "").split(","))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export class CitiesListQueryDto {
  @ApiPropertyOptional({ example: "DE" })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({ example: "10115 Berlin" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example: ["67f0c1a2b3c4d5e6f7a8b9c0", "67f0c1a2b3c4d5e6f7a8b9c1"],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => normalizeIds(value))
  ids?: string[];
}
