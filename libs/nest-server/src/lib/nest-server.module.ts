import { DynamicModule, Module } from '@nestjs/common';
import { IServerParams } from '@node-socket/server';
import { ConnectorsRegistryService } from './services/connectors-registry/connectors-registry.service';
import { GatewayService } from './services/gateway/gateway.service';

export class NestServerModule {
  public static forRoot(params: INestServerModuleParams): DynamicModule {
    const serverConf: IServerParams = {
      prefixMessages: params.prefixMessages,
    };
    return {
      module: NestServerModule,
      providers: [
        {
          provide: 'SERVER_CONF',
          useValue: serverConf,
        },
        ConnectorsRegistryService,
        GatewayService
      ],
      exports: [
        ConnectorsRegistryService
      ],
    };
  }
}

export interface INestServerModuleParams {
  prefixMessages?: string;
}