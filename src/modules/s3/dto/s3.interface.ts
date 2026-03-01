export interface UploadUrlResponse {
    presignedUrl: string;
    publicUrl: string;
}

export interface FileInfo {
    originalFileName: string;
    fileType: string;
}

export enum UploadType {
    AVATAR = 'avatars',
    TOUR = 'tours',
    HOMESTAY = 'homestays',
    ROOM = 'rooms',
    VEHICLE = 'vehicles',
    GUIDE = 'guides',
    PERMIT_DOCUMENT = 'permit-documents',
    IDENTITY_PROOF = 'identity-proofs',
    PASSPORT_PHOTO = 'passport-photos',
    POI = 'poi',
    REVIEW = 'reviews',
}

/**
 * Determines which upload types go to public vs private folders
 */
export const PUBLIC_UPLOAD_TYPES: UploadType[] = [
    UploadType.AVATAR,
    UploadType.TOUR,
    UploadType.HOMESTAY,
    UploadType.ROOM,
    UploadType.VEHICLE,
    UploadType.GUIDE,
    UploadType.POI,
    UploadType.REVIEW,
];

export const PRIVATE_UPLOAD_TYPES: UploadType[] = [
    UploadType.PERMIT_DOCUMENT,
    UploadType.IDENTITY_PROOF,
    UploadType.PASSPORT_PHOTO,
];