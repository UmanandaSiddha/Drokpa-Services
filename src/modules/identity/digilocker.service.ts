import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { URLSearchParams } from 'url';

@Injectable()
export class DigiLockerService {
    private readonly logger = new Logger(DigiLockerService.name);
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    private readonly apiBaseUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.clientId = this.configService.get<string>('DIGILOCKER_CLIENT_ID') || '';
        this.clientSecret = this.configService.get<string>('DIGILOCKER_CLIENT_SECRET') || '';
        this.redirectUri = this.configService.get<string>('DIGILOCKER_REDIRECT_URI') || '';
        this.apiBaseUrl = this.configService.get<string>('DIGILOCKER_API_BASE_URL') || 'https://api.digilocker.gov.in';

        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            this.logger.warn('DigiLocker credentials not configured. DigiLocker integration will be disabled.');
        }
    }

    /**
     * Generate OAuth authorization URL
     */
    generateAuthUrl(state: string): string {
        if (!this.clientId || !this.redirectUri) {
            throw new BadRequestException('DigiLocker is not configured');
        }

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state: state,
            scope: 'read',
        });

        return `${this.apiBaseUrl}/oauth2/1/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token?: string;
    }> {
        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            throw new BadRequestException('DigiLocker is not configured');
        }

        try {
            const tokenUrl = `${this.apiBaseUrl}/oauth2/1/token`;
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
            });

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error(`DigiLocker token exchange failed: ${error}`);
                throw new BadRequestException('Failed to exchange code for token');
            }

            return await response.json();
        } catch (error) {
            this.logger.error(`DigiLocker token exchange error:`, error);
            throw new BadRequestException('Failed to exchange code for token');
        }
    }

    /**
     * Fetch user profile from DigiLocker
     */
    async fetchUserProfile(accessToken: string): Promise<any> {
        try {
            const profileUrl = `${this.apiBaseUrl}/v1/profile`;
            const response = await fetch(profileUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error(`DigiLocker profile fetch failed: ${error}`);
                throw new BadRequestException('Failed to fetch user profile');
            }

            return await response.json();
        } catch (error) {
            this.logger.error(`DigiLocker profile fetch error:`, error);
            throw new BadRequestException('Failed to fetch user profile');
        }
    }

    /**
     * Fetch user documents from DigiLocker
     */
    async fetchUserDocuments(accessToken: string): Promise<any> {
        try {
            const documentsUrl = `${this.apiBaseUrl}/v1/files`;
            const response = await fetch(documentsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error(`DigiLocker documents fetch failed: ${error}`);
                throw new BadRequestException('Failed to fetch user documents');
            }

            return await response.json();
        } catch (error) {
            this.logger.error(`DigiLocker documents fetch error:`, error);
            throw new BadRequestException('Failed to fetch user documents');
        }
    }

    /**
     * Generate a secure state token
     */
    generateStateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }
}
