import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    type: String,
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 20)
  currentPassword: string;

  @ApiProperty({
    description: 'New password',
    type: String,
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 20)
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password',
    type: String,
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 20)
  confirmNewPassword: string;
}
