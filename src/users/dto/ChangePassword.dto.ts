import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  confirmNewPassword: string;
}
