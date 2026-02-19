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