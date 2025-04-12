import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { promises as fs } from 'fs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Homepage HTML')
@Controller()
export class AppController {
  @ApiOkResponse({
    description: 'OK',
    status: 200,
  })
  @ApiNotFoundResponse({
    description: 'HTML file not found',
    status: 404,
  })
  @ApiResponse({
    description: 'Internal Server Error',
    status: 500,
  })
  @Get()
  async getServerStatus(@Res() res: Response) {
    try {
      const filePath = join(process.cwd(), 'client', 'index.html');
      const html = await fs.readFile(filePath, 'utf-8');

      // Set the appropriate headers
      res.setHeader('Content-Type', 'text/html');

      // Send the file
      res.send(html);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }
}
