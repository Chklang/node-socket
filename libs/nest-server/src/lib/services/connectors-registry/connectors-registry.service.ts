import { Injectable } from '@nestjs/common';
import * as Server from '@node-socket/server';

@Injectable()
export class ConnectorsRegistryService extends Server.ConnectorsRegistryService {

}
