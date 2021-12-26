import { DynamicModule, Module } from '@nestjs/common';
import { IServerParams } from '@node-socket/server';
import { ConnectorsRegistryService } from './services/connectors-registry/connectors-registry.service';
import { GatewayService } from './services/gateway/gateway.service';
import { GatewayEventsListenerService, IGatewayEventsListener } from './services/gateway-events-listener/gateway-events-listener.service';

// Uncomment to use @nrwl/nest generator
// @Module({
//   providers: [GatewayEventsListenerService],
// })
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
        {
          provide: 'GATEWAY_EVENTS_LISTENERS',
          useValue: params.gatewayEventsListeners || [],
        },
        ConnectorsRegistryService,
        GatewayService,
        GatewayEventsListenerService,
      ],
      exports: [
        GatewayService,
        ConnectorsRegistryService,
      ],
    };
  }
}

export interface INestServerModuleParams {
  /**
   * Prefix for messages sent by server (default is 'server_' + idMessage)
   */
  prefixMessages?: string;
  /**
   * List of gateway interceptors to listen events
   */
  gatewayEventsListeners?: { new(...args: any[]): IGatewayEventsListener }[];
}