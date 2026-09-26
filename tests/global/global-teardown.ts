export default async () => {
  console.log('\n🛑 Stopping Global Postgres + Redis Testcontainers...');
  await Promise.all([
    global.__POSTGRES_CONTAINER__?.stop({ remove: true, removeVolumes: true }),
    global.__REDIS_CONTAINER__?.stop({ remove: true, removeVolumes: true }),
  ]);
};
