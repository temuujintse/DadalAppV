import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../database/prisma.service';
import { MeDto } from './dto/me.dto';
import { UsersService } from './users.service';

/** Decoded size limit; the app sends ~256×256 JPEGs (typically 15–40 KB). */
export const MAX_PHOTO_BYTES = 64 * 1024;

/** Recognises the image by its bytes, never by what the client claims. */
export function sniffImage(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Profile photos. Stored in PostgreSQL (small, resized on the device) so no file storage is
 * needed. Only the user and members of their family may load a photo.
 */
@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async upload(userId: string, base64: string): Promise<MeDto> {
    const data = Buffer.from(base64.replace(/^data:[^,]*,/, ''), 'base64');
    const mime = sniffImage(data);
    if (!mime) {
      throw AppException.badRequest(
        ErrorCode.INVALID_IMAGE,
        'Зөвхөн JPEG, PNG эсвэл WebP зураг оруулна уу.',
      );
    }
    if (data.length > MAX_PHOTO_BYTES) {
      throw AppException.badRequest(ErrorCode.INVALID_IMAGE, 'Зургийн хэмжээ хэт том байна.');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.userPhoto.upsert({
        where: { userId },
        create: { userId, mime, data },
        update: { mime, data },
      }),
      this.prisma.userProfile.update({ where: { userId }, data: { photoUpdatedAt: now } }),
    ]);
    return this.users.getMe(userId);
  }

  async remove(userId: string): Promise<MeDto> {
    await this.prisma.$transaction([
      this.prisma.userPhoto.deleteMany({ where: { userId } }),
      this.prisma.userProfile.update({ where: { userId }, data: { photoUpdatedAt: null } }),
    ]);
    return this.users.getMe(userId);
  }

  /** The photo of `ownerId` if `viewerId` is the owner or in the same family. */
  async read(
    viewerId: string,
    ownerId: string,
  ): Promise<{ mime: string; data: Buffer; updatedAt: Date }> {
    if (viewerId !== ownerId) {
      const [a, b] = await Promise.all([
        this.prisma.familyMember.findUnique({
          where: { userId: viewerId },
          select: { familyId: true },
        }),
        this.prisma.familyMember.findUnique({
          where: { userId: ownerId },
          select: { familyId: true },
        }),
      ]);
      if (!a || !b || a.familyId !== b.familyId) throw this.notFound();
    }
    const photo = await this.prisma.userPhoto.findUnique({ where: { userId: ownerId } });
    if (!photo) throw this.notFound();
    return { mime: photo.mime, data: Buffer.from(photo.data), updatedAt: photo.updatedAt };
  }

  private notFound() {
    return AppException.notFound(ErrorCode.PHOTO_NOT_FOUND, 'Зураг олдсонгүй.');
  }
}
