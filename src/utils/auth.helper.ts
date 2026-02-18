import { Prisma } from "generated/prisma/client";

export const SAFE_USER_SELECT = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
    gender: true,
    phoneNumber: true,
    dateOfBirth: true,
    timezone: true,
    isVerified: true,
    isOnline: true,
    isDisabled: true,
    isDeleted: true,
    deletedAt: true,
    notificationPreferences: true,
    lastLogin: true,
    lastSeen: true,
    createdAt: true,
    updatedAt: true,
};

export type SafeUser = Prisma.UserGetPayload<{
    select: typeof SAFE_USER_SELECT & {
        roles: true;
        provider: { select: { id: true } };
    };
}> & { providerId?: string };