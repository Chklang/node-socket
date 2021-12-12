import { Module } from '@nestjs/common';
import { ConnectorsRegistryService } from './services/connectors-registry/connectors-registry.service';
import { GatewayService } from './services/gateway/gateway.service';

@Module({
  controllers: [],
  providers: [
    ConnectorsRegistryService,
    GatewayService
  ],
  exports: [
    ConnectorsRegistryService
  ],
})
export class NestServerModule {}
