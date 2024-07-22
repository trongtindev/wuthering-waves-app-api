import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { AuthGuard } from '../auth/auth.guard';
import { GetBackupQueryDto, PutBackupBodyDto } from './backup.dto';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserDocument } from '../user/user.schema';
import { UserDecorator } from '../user/user.decorator';

@ApiTags('backup')
@Controller('backup')
export class BackupController {
  constructor(private backupService: BackupService) {}

  @ApiResponse({ description: 'Get backup info' })
  @UseGuards(AuthGuard)
  @Get()
  async get(
    @UserDecorator() user: UserDocument,
    @Query() query: GetBackupQueryDto
  ) {
    return await this.backupService.get(user._id, {
      withData: query.withData
    });
  }

  @ApiResponse({ description: 'Upload new backup' })
  @UseGuards(AuthGuard)
  @Post()
  async put(
    @UserDecorator() user: UserDocument,
    @Body() body: PutBackupBodyDto
  ) {
    return await this.backupService.put(user._id, {
      data: body.data
    });
  }

  @ApiResponse({ description: 'Delete current backup' })
  @UseGuards(AuthGuard)
  @Delete()
  async eraseAll(@UserDecorator() user: UserDocument) {
    return await this.backupService.eraseAll(user._id);
  }
}
