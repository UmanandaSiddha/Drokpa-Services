import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as admin from 'firebase-admin'

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
    constructor(private readonly config: ConfigService) { }

    onModuleInit() {
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: this.config.get<string>('FIREBASE_PROJECT_ID'),
                    clientEmail: this.config.get<string>('FIREBASE_CLIENT_EMAIL'),
                    privateKey: this.config
                        .get<string>('FIREBASE_PRIVATE_KEY')
                        ?.replace(/\\n/g, '\n'),
                }),
            })
        }
    }

    async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
        return admin.auth().verifyIdToken(idToken)
    }
}