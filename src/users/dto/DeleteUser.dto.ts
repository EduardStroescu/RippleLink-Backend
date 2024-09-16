import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty({
    description: 'Current User password',
    type: String,
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 20)
  currentPassword: string;

  @ApiProperty({
    description: 'Confirm current User password',
    type: String,
    minLength: 5,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 20)
  confirmCurrentPassword: string;
}
