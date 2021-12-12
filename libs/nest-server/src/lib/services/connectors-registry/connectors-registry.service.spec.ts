import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorsRegistryService } from './connectors-registry.service';

describe('ConnectorsRegistryService', () => {
  let service: ConnectorsRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConnectorsRegistryService],
    }).compile();

    service = module.get<ConnectorsRegistryService>(ConnectorsRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
