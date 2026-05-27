// import { DataSource } from 'typeorm';
// import { config } from 'dotenv';

// config(); // load .env khi chạy CLI

// export default new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST || 'localhost',
//   port: +(process.env.DB_PORT || 5432),
//   username: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASSWORD || 'postgres',
//   database: process.env.DB_NAME || 'SEP490_G57',
//   schema: process.env.DB_SCHEMA || 'public',
//   entities: [__dirname + '/**/*.entity{.ts,.js}'],
//   migrations: [__dirname + '/migrations/**/*{.ts,.js}'],