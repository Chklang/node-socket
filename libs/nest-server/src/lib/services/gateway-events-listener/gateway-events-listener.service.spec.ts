import { Test, TestingModule } from '@nestjs/testing';
import { GatewayEventsListenerService } from './gateway-events-listener.service';

describe('GatewayEventsListenerService', () => {
  let service: GatewayEventsListenerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayEventsListenerService,
        {
          provide: 'GATEWAY_EVENTS_LISTENERS',
          useValue: [],
        }
      ],
    }).compile();

    service = module.get<GatewayEventsListenerService>(GatewayEventsListenerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
