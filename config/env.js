import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvConfig = () => {
    dotenv.config({ path: path.join(__dirname, '../.env') });

    const requiredEnvVars = ['MONGODB_URI'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingEnvVars.length > 0) {
        console.error('Error: Missing required environment variables:');
        missingEnvVars.forEach(envVar => console.error(`- ${envVar}`));
        console.error('\nPlease create a .env file with the following format:');
        console.error(`
MONGODB_URI=mongodb://username:password@host:port/database
PORT=3000 # Optional, defaults to 3000
NODE_ENV=development # Optional, defaults to development
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com # Optional, defaults to *
        `);
        process.exit(1);
    }
};

export { loadEnvConfig };