import { Controller, Get, UseGuards } from '@nestjs/common';
import { MapService } from './map.service';

@Controller('map')
export class MapController {
  constructor(private mapService: MapService) {}

  @Get('markers')
  async markers() {
    return await this.mapService.markers();
  }
}
