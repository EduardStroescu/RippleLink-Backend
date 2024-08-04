import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
  @ApiProperty({
    type: String,
    description: 'An Email Address is required.',
    minLength: 8,
    maxLength: 20,
  })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    description: 'A password is required.',
    minLength: 5,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
