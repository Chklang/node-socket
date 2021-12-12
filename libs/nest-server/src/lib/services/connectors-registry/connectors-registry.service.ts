import { Injectable } from '@nestjs/common';
import * as Server from '@nest-socket/server';

@Injectable()
export class ConnectorsRegistryService extends Server.ConnectorsRegistryService {

}
