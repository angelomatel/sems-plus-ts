// Live check against a real SEMS+ account. Reads SEMS_ACCOUNT and
// SEMS_PASSWORD from .env (see .env.example); prints no credentials or tokens.
//
//   npm run build && npm run smoke
import { SemsPlus } from '../dist/index.js';

const account = process.env.SEMS_ACCOUNT;
const password = process.env.SEMS_PASSWORD;
if (!account || !password) {
  console.error('Set SEMS_ACCOUNT and SEMS_PASSWORD in .env first.');
  process.exit(1);
}
const timeZone = process.env.SEMS_TIMEZONE === undefined ? undefined : Number(process.env.SEMS_TIMEZONE);

const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');
const sems = new SemsPlus({ account, password });

await sems.login();
console.log(`Logged in; region: ${sems.region ?? 'unknown'}`);

const stations = await sems.stations.list();
console.log(`Stations: ${stations.map((s) => `${s.name} (${s.capacityKw ?? '?'} kW)`).join(', ')}`);
const station = stations[0];
if (!station) process.exit(0);

const info = await sems.stations.info(station.id);
console.log(`Created: ${info.created}; PV ${info.pvCapacityKw} kW; battery ${info.batteryCapacityKwh} kWh`);

const devices = await sems.devices.list(station.id);
console.log(`Devices: ${devices.map((d) => `${d.deviceType}:${d.name}`).join(', ')}`);

const flow = await sems.stations.powerFlow(station.id);
console.log(`Now: pv ${flow.pv} kW, load ${flow.load} kW, battery ${flow.battery} kW, grid ${flow.grid} kW, soc ${flow.soc}%`);

const stats = await sems.statistics.get(station.id, { dimension: 'day', from: yesterday, to: yesterday });
console.log(`Yesterday (${yesterday}) daily stats:`, stats.periods[0] ?? 'none');

const curve = await sems.power.curve(station.id, yesterday, { timeZone });
const pvKwh = curve.samples.reduce((sum, s) => sum + (s.pv ?? 0), 0) / 60;
const gaps = curve.samples.filter((s) => s.pv === null).length;
console.log(`Curve: ${curve.samples.length} samples, ${gaps} PV gaps, integrated PV ${pvKwh.toFixed(2)} kWh`);
console.log(`First/last: ${curve.samples[0]?.time} → ${curve.samples.at(-1)?.time}`);

const alarms = await sems.alarms.counts(station.id);
console.log(`Alarms: ${alarms.active} active, ${alarms.recovered} recovered`);
