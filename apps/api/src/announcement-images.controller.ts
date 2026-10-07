import { Controller, Get, Post, Param, UploadedFile, UseInterceptors, BadRequestException, NotFoundException, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const sharp: typeof import('sharp').default = require('sharp');
import { Roles } from './auth/roles.decorator';
import { Public } from './auth/public.decorator';

const directory = () => resolve(process.env.ANNOUNCEMENT_UPLOAD_DIR || 'uploads/announcements');
@Controller()
export class AnnouncementImagesController {
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('admin/announcements/images')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }))
  async upload(@UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('INVALID_IMAGE');
    let image: Buffer;
    try {
      const decoder = sharp(file.buffer, { limitInputPixels: 20_000_000, animated: false });
      const info = await decoder.metadata();
      if (!['jpeg', 'png', 'webp'].includes(info.format || '') || (info.pages || 1) > 1) throw new Error('format');
      image = await decoder.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { throw new BadRequestException('INVALID_IMAGE'); }
    const id = randomUUID();
    await mkdir(directory(), { recursive: true });
    await writeFile(join(directory(), `${id}.webp`), image, { flag: 'wx' });
    return { success: true, data: { url: `/api/media/announcements/${id}` } };
  }
  @Public()
  @Get('media/announcements/:id')
  async image(@Param('id') id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new NotFoundException();
    try { return new StreamableFile(await readFile(join(directory(), `${id}.webp`)), { type: 'image/webp', disposition: 'inline' }); }
    catch { throw new NotFoundException(); }
  }
}
