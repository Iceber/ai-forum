import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PresignDto } from './dto/presign.dto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly configService: ConfigService) {}

  async getPresignedUrl(dto: PresignDto, userId: string) {
    const ext = dto.filename.split('.').pop() || 'bin';
    const key = `uploads/${userId}/${uuidv4()}.${ext}`;

    const s3Endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'http://localhost:9000',
    );
    const s3Bucket = this.configService.get<string>('S3_BUCKET', 'ai-forum');

    const uploadUrl = `${s3Endpoint}/${s3Bucket}/${key}?presigned=true`;
    const fileUrl = `${s3Endpoint}/${s3Bucket}/${key}`;

    this.logger.log(
      `Presign URL generated: userId=${userId}, key=${key}, contentType=${dto.contentType}`,
    );

    return { uploadUrl, fileUrl };
  }
}
