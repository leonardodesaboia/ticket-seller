import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe — process is running' })
  @ApiResponse({ status: 200, description: 'OK' })
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — process is ready to serve traffic' })
  @ApiResponse({ status: 200, description: 'OK' })
  ready(): { status: string } {
    return { status: 'ok' };
  }
}
