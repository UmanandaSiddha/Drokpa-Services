import { Injectable, ConsoleLogger } from '@nestjs/common';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

@Injectable()
export class LoggerService extends ConsoleLogger {
    async logToFile(entry: any, type: 'ERROR' | 'LOG') {
        const formattedEntry = `${type}\t${Intl.DateTimeFormat('en-US', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata',
        }).format(new Date())}\t${entry}\n`

        const logsDir = path.resolve(__dirname, '..', '..', '..', 'logs');

        try {
            if (!fs.existsSync(path.join(logsDir))) {
                await fsPromises.mkdir(path.join(logsDir), { recursive: true });
            }
            await fsPromises.appendFile(path.join(logsDir, 'LogFile.log'), formattedEntry);
        } catch (e) {
            if (e instanceof Error) console.error(e.message)
        }
    }

    convertToString(message: any): string {
        if (typeof message !== 'string') {
            const compact = JSON.stringify(message);
            message = compact
                .replace(/:/g, ': ')
                .replace(/,/g, ', ');
        }

        return message;
    }

    log(message: any, context?: string) {
        message = this.convertToString(message);
        const entry = `${context ?? this.context ?? ''}\t${message}`;
        this.logToFile(entry, 'LOG');
        if (context !== undefined) {
            super.log(message, context);
        } else {
            super.log(message);
        }
    }

    error(message: any, stackOrContext?: string) {
        message = this.convertToString(message);
        const entry = `${stackOrContext ?? this.context ?? ''}\t${message}`;
        this.logToFile(entry, 'ERROR');
        if (stackOrContext !== undefined) {
            super.error(message, stackOrContext);
        } else {
            super.error(message);
        }
    }

    warn(message: any, context?: string) {
        message = this.convertToString(message);
        const entry = `${context ?? this.context ?? ''}\t${message}`;
        this.logToFile(entry, 'LOG');
        if (context !== undefined) {
            super.warn(message, context);
        } else {
            super.warn(message);
        }
    }

    debug(message: any, context?: string) {
        message = this.convertToString(message);
        super.debug(message, context)
    }

    verbose(message: any, context?: string) {
        message = this.convertToString(message);
        super.verbose(message, context)
    }
}