import { ApiProperty } from '@nestjs/swagger';

export class HealthSuccessResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: 'Redis is running' })
  message: string;
}

export class HealthErrorResponseDto {
  @ApiProperty({ example: 'error' })
  status: string;

  @ApiProperty({ example: 'Redis is not running' })
  message: string;
}
