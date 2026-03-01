/**
 * Slug Helper Utility
 * Generates URL-friendly slugs from titles/names and handles uniqueness
 */

import crypto from 'crypto';

/**
 * Converts a string to a URL-friendly slug
 * @example
 * generateSlug('The Great Adventures') => 'the-great-adventures'
 * generateSlug('  Multi   Space  ') => 'multi-space'
 */
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generates a unique slug by appending a short hash if needed
 * @param baseSlug The base slug to start with
 * @param existingSlugs Set or array of already used slugs
 * @returns A unique slug with hash suffix if baseSlug exists
 *
 * @example
 * generateUniqueSlug('mountain-trek', new Set(['mountain-trek']))
 * => 'mountain-trek-a3x9'
 */
export function generateUniqueSlug(
    baseSlug: string,
    existingSlugs: Set<string> | string[],
): string {
    const existing = new Set(existingSlugs);

    if (!existing.has(baseSlug)) {
        return baseSlug;
    }

    // Append 4-char hash from timestamp (guaranteed unique, very short)
    const hash = crypto
        .createHash('md5')
        .update(`${baseSlug}-${Date.now()}`)
        .digest('hex')
        .slice(0, 4);

    return `${baseSlug}-${hash}`;
}

/**
 * Generates a slug from title/name and checks uniqueness against database
 * Typically used in services during create/update operations
 *
 * @param text The text to slugify
 * @param checkUniqueness Async function to check if slug exists in DB
 * @returns A unique slug with hash suffix if collision occurs
 */
export async function generateUniqueSlugFromText(
    text: string,
    checkUniqueness: (slug: string) => Promise<boolean>,
): Promise<string> {
    const baseSlug = generateSlug(text);

    // Try base slug first (most common case)
    if (!(await checkUniqueness(baseSlug))) {
        return baseSlug;
    }

    // Fallback: append short hash (guaranteed unique with 1 DB query)
    const hash = crypto
        .createHash('md5')
        .update(`${baseSlug}-${Date.now()}`)
        .digest('hex')
        .slice(0, 4);

    return `${baseSlug}-${hash}`;
}
