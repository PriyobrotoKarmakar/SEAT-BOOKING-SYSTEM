import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config();

let redis;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
} else {
    console.warn("Upstash Redis credentials missing.");
}

export default redis;
