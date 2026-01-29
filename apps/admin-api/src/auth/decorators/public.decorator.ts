import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'isPublic';

export const Public = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(PUBLIC_KEY, true);
