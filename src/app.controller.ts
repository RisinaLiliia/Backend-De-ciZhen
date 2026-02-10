// src/app.controller.ts
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPublicErrors } from "./common/swagger/api-errors.decorator";
import { AppService } from "./app.service";

@ApiTags("system")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "Root endpoint" })
  @ApiSecurity({} as any)
  @ApiOkResponse({ schema: { type: "string", example: "Hello World!" } })
  @ApiPublicErrors()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  @ApiOperation({ summary: "Health check" })
  @ApiSecurity({} as any)
  @ApiOkResponse({ schema: { type: "object", example: { ok: true } } })
  @ApiPublicErrors()
  health() {
    return { ok: true };
  }
}
