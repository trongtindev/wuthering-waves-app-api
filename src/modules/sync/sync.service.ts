import {
  GetObjectCommand,
  S3Client,
  S3ServiceException,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  BadGatewayException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { assert } from 'console';
import { Types } from 'mongoose';

@Injectable()
export class SyncService implements OnApplicationBootstrap {
  private logger = new Logger(SyncService.name);
  private client: S3Client;

  constructor(private eventEmitter: EventEmitter2) {}

  onApplicationBootstrap() {
    this.logger.verbose('onApplicationBootstrap');
    this.initialize();
  }

  async initialize() {
    // destroy old instance
    if (this.client) this.client.destroy();

    const {
      SYNC_S3_PATH,
      SYNC_S3_ENDPOINT,
      SYNC_S3_REGION,
      SYNC_S3_BUCKET,
      SYNC_S3_ACCESS_KEY_ID,
      SYNC_S3_SECRET_ACCESS_KEY,
    } = process.env;
    assert(SYNC_S3_PATH);
    assert(SYNC_S3_ENDPOINT);
    assert(SYNC_S3_REGION);
    assert(SYNC_S3_BUCKET);
    assert(SYNC_S3_ACCESS_KEY_ID);
    assert(SYNC_S3_SECRET_ACCESS_KEY);

    this.client = new S3Client({
      region: SYNC_S3_REGION,
      credentials: {
        accessKeyId: SYNC_S3_ACCESS_KEY_ID,
        secretAccessKey: SYNC_S3_SECRET_ACCESS_KEY,
      },
      endpoint: SYNC_S3_ENDPOINT,
    });
  }

  async pull(
    user: Types.ObjectId,
    options?: {
      withData?: boolean;
    },
  ) {
    const key = user.toString();
    this.logger.verbose(`pull(${key})`);

    options ??= {};

    try {
      const { SYNC_S3_PATH, SYNC_S3_BUCKET } = process.env;
      const command = new GetObjectCommand({
        Key: `${SYNC_S3_PATH}/${key}.json`,
        Bucket: SYNC_S3_BUCKET,
      });
      const result = await this.client.send(command);

      return {
        size: result.ContentLength || 0,
        content: options.withData
          ? await result.Body.transformToString()
          : undefined,
        createdAt: result.LastModified || new Date(),
      };
    } catch (error) {
      if (error instanceof S3ServiceException) {
        if (error.$metadata.httpStatusCode === 404) {
          return {
            size: 0,
            createdAt: 0,
          };
        }
      }

      this.logger.error(error);
      throw new BadGatewayException(error.message);
    }
  }

  async push(
    user: Types.ObjectId,
    args: {
      data: string;
    },
  ) {
    const key = user.toString();
    this.logger.verbose(`push(${key})`);

    try {
      const json = JSON.parse(args.data);
      const { SYNC_S3_PATH, SYNC_S3_BUCKET } = process.env;
      const command = new PutObjectCommand({
        Key: `${SYNC_S3_PATH}/${key}.json`,
        Body: JSON.stringify(json),
        Bucket: SYNC_S3_BUCKET,
        ACL: 'private',
      });
      this.logger.log(`push(${key}) send`);
      await this.client.send(command);
      this.logger.log(`push(${key}) done`);
    } catch (error) {
      this.logger.error(error);
      throw new BadGatewayException(error.message);
    }

    return await this.pull(user);
  }

  async eraseAll(user: Types.ObjectId) {
    const key = user.toString();
    this.logger.verbose(`eraseAll(${key})`);

    try {
      const { SYNC_S3_PATH, SYNC_S3_BUCKET } = process.env;
      const command = new DeleteObjectCommand({
        Key: `${SYNC_S3_PATH}/${key}.json`,
        Bucket: SYNC_S3_BUCKET,
      });
      await this.client.send(command);
    } catch (error) {
      this.logger.error(error);
      throw new BadGatewayException(error.message);
    }
  }
}
