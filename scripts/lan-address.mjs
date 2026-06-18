import os from "node:os";

/** IPv4 addresses reachable on the local network (Wi‑Fi/Ethernet). */
export function getLanAddresses() {
  let nets;
  try {
    nets = os.networkInterfaces();
  } catch {
    return [];
  }
  const addrs = [];
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  return addrs;
}

export function formatLanUrls(port, { https = false } = {}) {
  const scheme = https ? "https" : "http";
  return getLanAddresses().map((ip) => `${scheme}://${ip}:${port}`);
}
