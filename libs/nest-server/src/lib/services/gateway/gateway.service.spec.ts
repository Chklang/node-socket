import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorsRegistryService } from '../connectors-registry/connectors-registry.service';
import { GatewayService } from './gateway.service';

describe('GatewayService', () => {
  let service: GatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GatewayService, ConnectorsRegistryService, {
        provide: 'SERVER_CONF',
        useValue: {}
      }],
    }).compile();

    service = module.get<GatewayService>(GatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
