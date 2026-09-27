import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { PexelsImageSearch } from './pexels-image-search.service';

@Module({
  controllers: [ImagesController],
  providers: [PexelsImageSearch],
})
export class ImagesModule {}
