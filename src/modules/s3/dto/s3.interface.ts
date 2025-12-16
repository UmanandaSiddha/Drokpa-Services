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
    MENU_ITEM = 'menu-items',
    EVENT = 'events',
    CART_REFERENCE = 'cart-references',
    APP_BANNER = 'app-banners'
}