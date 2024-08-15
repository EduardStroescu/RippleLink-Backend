import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty({
    description: 'Current User password',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'Confirm current User password',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  confirmCurrentPassword: string;
}
