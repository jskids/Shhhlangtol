const os = require('os');

/**
 * Detects usable non-internal IPv4 addresses from local network interfaces.
 * @returns {Array<{interface: string, address: string}>} List of detected local IPv4 addresses.
 */
function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Check for IPv4 and exclude internal loopback interfaces (127.0.0.1)
      const isIPv4 = net.family === 'IPv4' || net.family === 4;
      if (isIPv4 && !net.internal) {
        addresses.push({ interfaceName: name, address: net.address });
      }
    }
  }

  return addresses;
}

module.exports = { getLocalIPv4Addresses };
