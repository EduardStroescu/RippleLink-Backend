import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export default class ChangeAvatarDto {
  @ApiProperty({
    description: 'Avatar file as a base64 encoded string.',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  avatar: string;
}
