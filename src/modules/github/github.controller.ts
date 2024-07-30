import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GithubService } from './github.service';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { UserDecorator } from '../user/user.decorator';
import { UserDocument } from '../user/user.schema';
import { GithubCommitBodyDto } from './github.dto';
import * as prettier from 'prettier';

@Controller('github')
export class GithubController {
  constructor(private githubService: GithubService) {}

  @Throttle({
    commit: {
      ttl: 60 * 30 * 1000,
      limit: 30
    }
  })
  @UseGuards(AuthGuard)
  @Post('commit')
  async commit(
    @UserDecorator() user: UserDocument,
    @Body() body: GithubCommitBodyDto
  ) {
    const content = await prettier.format(body.data, {
      endOfLine: 'crlf',
      parser: 'json'
    });
    return await this.githubService.commit(user, { path: body.path, content });
  }
}
