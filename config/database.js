import mongoose from 'mongoose';

const connectWithRetry = async () => {
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            if (!process.env.MONGODB_URI) {
                throw new Error('MONGODB_URI environment variable is not defined');
            }

            console.log('Attempting to connect to MongoDB...');
            console.log(`Connection string: ${process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('MongoDB connected successfully');
            break;
        } catch (err) {
            retries += 1;
            console.error(`MongoDB connection attempt ${retries} failed:`, err.message);

            if (err.name === 'MongoParseError') {
                console.error('Invalid MongoDB connection string format.');
            } else if (err.name === 'MongoNetworkError') {
                console.error('Network error while trying to connect to MongoDB.');
            }

            if (retries === maxRetries) {
                console.error('Max retries reached. Exiting...');
                process.exit(1);
            }

            const delay = Math.min(1000 * Math.pow(2, retries), 10000);
            console.log(`Waiting ${delay}ms before retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

export { connectWithRetry };
