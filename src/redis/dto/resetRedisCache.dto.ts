import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ResetRedisCacheDto {
  @ApiProperty({
    description: 'Admin ID',
    type: String,
  })
  @IsString()
  adminId: string;

  @ApiProperty({
    description: 'Admin Password',
    type: String,
  })
  @IsString()
  adminPassword: string;
}
