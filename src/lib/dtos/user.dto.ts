import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { SettingsDto } from './settings.dto';
import { StatusMessageDto } from './status.dto';

export class PrivateUserDto {
  @ApiProperty({
    description: 'User ID',
    type: String,
  })
  _id: string;

  @ApiProperty({
    description: 'User email address',
    type: String,
  })
  email: string;

  @ApiProperty({
    description: 'User first name',
    type: String,
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    type: String,
  })
  lastName: string;

  @ApiPropertyOptional({
    description: 'User display name',
    type: String,
  })
  displayName?: string;

  @ApiPropertyOptional({
    description: "URL to the user's avatar image.",
    type: String,
  })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'User refresh token',
    type: String,
  })
  refresh_token?: string;

  @ApiPropertyOptional({
    description: 'Status ID',
    type: StatusMessageDto,
  })
  status?: StatusMessageDto;

  @ApiPropertyOptional({
    description: 'List of chat IDs associated with the user.',
    type: [String],
  })
  chats?: string[];

  @ApiPropertyOptional({
    description: 'Settings ID',
    type: SettingsDto,
  })
  settings?: SettingsDto;
}

export class PublicUserDto extends PickType(PrivateUserDto, [
  '_id',
  'displayName',
  'avatarUrl',
] as const) {}
