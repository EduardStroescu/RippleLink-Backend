import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export default class ChangeAvatarDto {
  @ApiProperty({
    description: 'Avatar URL base64 encoded',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  avatar: string;
}
