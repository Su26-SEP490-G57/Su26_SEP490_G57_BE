export default async () => {
  console.log('\n🛑 Stopping Global Postgres Testcontainer...');
  await global.__POSTGRES_CONTAINER__?.stop({ remove: true, removeVolumes: true });
};
