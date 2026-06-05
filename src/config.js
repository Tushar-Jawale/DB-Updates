const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orders_db',
  port: parseInt(process.env.PORT, 10) || 3000,
  notifyChannel: 'orders_channel',
};

export default config;
