import { SetMetadata } from '@nestjs/common';

export const setRoles = (...args: string[]) => SetMetadata('roles', args);
