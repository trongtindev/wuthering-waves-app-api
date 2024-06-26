import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Comment,
  CommentChannel,
  CommentChannelDocument,
  CommentDocument
} from './comment.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../user/user.schema';
import { IAfterCreateCommentEventArgs, IComment } from './comment.interface';
import { CommentEventType } from './comment.types';
import { FileService } from '../file/file.service';
import { UserService } from '../user/user.service';
import { IFile } from '../file/file.interface';

@Injectable()
export class CommentService {
  private logger = new Logger(CommentService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(CommentChannel.name)
    private commentChannelModel: Model<CommentChannel>,
    private fileService: FileService,
    private userService: UserService
  ) {}

  async resolve(document: CommentDocument): Promise<IComment> {
    const user = await (async () => {
      if (document.guest) {
        return document.guest;
      }
      const user = await this.userService.get(document.user);
      return await this.userService.resolve(user);
    })();
    const attachments = await Promise.all(
      document.attachments.map(async (e) => {
        const file = await this.fileService.findById(e);
        return file ? await this.fileService.resolve(file) : undefined;
      })
    );

    return {
      id: document.id,
      user,
      content: document.content.replaceAll('\n', '<br/>'),
      likes: document.likes.length,
      dislikes: document.dislikes.length,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      attachments: attachments.filter((e) => e)
    };
  }

  async upsertChannel(url: string): Promise<CommentChannelDocument> {
    const document = await this.commentChannelModel.findOne({
      url
    });
    if (document) return document;

    return await this.commentChannelModel.create({
      url
    });
  }

  async listComment(
    url: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ) {
    options ??= {};
    options.limit ??= 10;
    options.offset ??= 0;

    const channel = await this.upsertChannel(url);
    const items = await this.commentModel
      .find({
        _id: {
          $in: channel.comments
        }
      })
      .limit(options.limit)
      .skip(options.offset)
      .sort({
        createdAt: 'desc'
      });

    const total = channel.comments.length;

    return {
      total: total,
      items: items
    };
  }

  async createComment(
    user: Types.ObjectId,
    args: {
      channel: string;
      content: string;
      parent?: Types.ObjectId;
      attachments?: Types.ObjectId[];
    }
  ): Promise<CommentDocument> {
    if (args.attachments) {
      for (const element of args.attachments) {
        // if not exist, throw not found
        const file = await this.fileService.get(element);

        // if not owner, throw not found
        if (
          file.user.equals(user) === false ||
          file.expiresIn.getTime() === 0
        ) {
          // this.logger.verbose()
          throw new NotFoundException();
        }
      }
    }

    const channel = await this.upsertChannel(args.channel);
    const result = await this.commentModel.create({
      channel: channel._id,
      user,
      content: args.content,
      attachments: args.attachments
    });

    if (args.parent) {
      await this.commentModel.updateOne(
        {
          _id: args.parent
        },
        {
          $push: {
            replies: result._id
          }
        }
      );
    }

    // TODO: maybe move to events
    await this.commentChannelModel.updateOne(
      {
        _id: channel._id
      },
      {
        $push: {
          comments: result._id
        }
      }
    );

    // TODO: maybe move to events
    if (args.attachments) {
      args.attachments.forEach((e) => {
        this.fileService.setExpire(e, 0);
      });
    }

    // get document
    const document = await this.commentModel.findById(result);

    // emit event
    const eventArgs: IAfterCreateCommentEventArgs = { document };
    await this.eventEmitter.emitAsync(
      CommentEventType.afterCreateAsync,
      eventArgs
    );
    this.eventEmitter.emit(CommentEventType.afterCreate, eventArgs);

    return document;
  }
}
