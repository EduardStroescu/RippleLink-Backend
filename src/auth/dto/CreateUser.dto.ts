import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateChatDto } from 'src/chats/dto/CreateChat.dto';
import { CreateSettingsDto } from 'src/settings/dto/CreateSettings.dto';

export class CreateUserDto {
  @ApiProperty({
    type: String,
    description: 'An Email Address is required.',
    minLength: 8,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({
    type: String,
    description: 'A password is required.',
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    type: String,
    description: 'A matching password is required.',
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  confirmPassword?: string;

  @ApiProperty({
    type: String,
    description: 'A first name is required.',
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({
    type: String,
    description: 'A last name is required.',
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    type: String,
    description: 'This will be seen by other users.',
    minLength: 5,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Avatar Url.',
    minLength: 5,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Status message.',
    minLength: 5,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  statusMessage?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'User Chat Collection.',
    minLength: 5,
    maxLength: 20,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateChatDto)
  chats?: CreateChatDto;

  @ApiPropertyOptional({
    type: String,
    description: 'Account settings per user.',
    minLength: 5,
    maxLength: 20,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSettingsDto)
  settings?: CreateSettingsDto;
}
